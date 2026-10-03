import os
from datetime import date, timedelta

os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

from api import index  # noqa: E402
from interview_ready.db import Store  # noqa: E402
from interview_ready import plan as plan_svc  # noqa: E402

CV = (b"Head of TA\n- Reduced time to hire from 62 to 38 days across 120 roles\n- Led a team of 8 recruiters and managed a $1.2M agency budget\n"
      b"- Cut agency spend by 31% through a preferred supplier model\n")
JD = "- Strong P&L ownership and commercial acumen\n- Proven experience reducing time to hire\n- Experience with workforce planning\n"


def client():
    index._store = Store(":memory:")
    return TestClient(index.app)


def test_general_target_exists_and_cannot_be_deleted():
    c = client()
    d = c.get("/api/targets").json()
    gen = [t for t in d["targets"] if t["kind"] == "general"]
    assert len(gen) == 1 and d["active_id"] == gen[0]["id"]
    assert c.delete(f"/api/targets/{gen[0]['id']}").status_code == 400


def test_jd_from_board_creates_interview_target_and_gaps_follow_active_target():
    c = client()
    c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    d = c.get("/api/targets").json()
    interview = [t for t in d["targets"] if t["kind"] == "interview"]
    assert len(interview) == 1 and interview[0]["jd_text"].startswith("- Strong P&L") and d["active_id"] == interview[0]["id"]
    assert c.get("/api/workspace").json()["gaps"]
    c.post(f"/api/targets/{[t for t in d['targets'] if t['kind'] == 'general'][0]['id']}/activate")
    assert c.get("/api/workspace").json()["gaps"] == []  # General has no JD


def test_target_crud_and_validation():
    c = client()
    c.post("/api/analyze", files={"cv": ("cv.txt", CV)})
    when = (date.today() + timedelta(days=5)).isoformat()
    tid = c.post("/api/targets", json={"company": "Acme", "role": "Head of TA", "stage": "executive", "interview_date": when, "jd_text": JD}).json()["id"]
    t = [x for x in c.get("/api/targets").json()["targets"] if x["id"] == tid][0]
    assert t["days_left"] == 5 and t["stage"] == "executive" and "readiness" in t
    assert c.post("/api/targets", json={"stage": "nope"}).status_code == 400
    assert c.put(f"/api/targets/{tid}", json={"company": "Acme Inc", "role": "Head of TA", "stage": "panel", "interview_date": when}).status_code == 200
    assert c.delete(f"/api/targets/{tid}").status_code == 200
    assert all(x["id"] != tid for x in c.get("/api/targets").json()["targets"])


def test_readiness_is_capped_without_practice_and_lists_blockers():
    c = client()
    c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    r = c.get("/api/today").json()["readiness"]
    assert r["score"] <= 40 and r["blockers"] and r["label"] == "Not ready yet"
    ids = {x["id"] for x in r["criteria"]}
    assert {"cv", "claims", "gaps", "core", "stories", "research", "practice"} <= ids


def test_readiness_rises_with_evidence():
    c = client()
    c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    before = c.get("/api/today").json()["readiness"]["score"]
    good = ("The baseline was 62 days measured in our ATS. First, I rebuilt sourcing. Second, I automated screening. Third, I trained managers. "
            "For example, automation saved 11 days across 120 roles. The result was about $0.4M a year in vacancy cost and 31% less agency spend.")
    body = c.get("/api/workspace").json()
    for _ in range(3):
        s = c.post("/api/interview/start", json={"claims": body["claims"], "gap_items": body["gap_items"], "focus": body["claims"][0]["text"]}).json()
        state = s["state"]
        for _ in range(6):
            if not state["current"]:
                break
            state = c.post("/api/interview/answer", json={"session_id": s["session_id"], "state": state, "answer": good}).json()["state"]
    assert c.get("/api/today").json()["readiness"]["score"] > before


def test_core_questions_check_save_and_stage_mix():
    c = client()
    c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    tid = c.post("/api/targets", json={"company": "Acme", "role": "Head of TA", "stage": "screen", "jd_text": JD}).json()["id"]
    core = c.get("/api/core").json()
    assert core["stage_label"] == "HR or recruiter screen" and any(q["id"] == "salary" for q in core["questions"])
    assert any("Acme" in q["question"] for q in core["questions"] if q["id"] == "why_company")
    bad = c.post("/api/core/check", json={"question_id": "salary", "text": "Whatever is fair."}).json()
    assert not bad["ready"] and bad["fixes"]
    good = c.put("/api/core/answer", json={"question_id": "salary", "text": "Based on the scope and the 31% agency saving I delivered, I am targeting between 145 and 155 total, and I am open to discussing the full package."}).json()
    assert good["ready"]
    assert [q for q in c.get("/api/core").json()["questions"] if q["id"] == "salary"][0]["prepared"]["score"] >= 6
    body = c.get("/api/workspace").json()
    s = c.post("/api/interview/start", json={"claims": body["claims"], "gap_items": body["gap_items"], "mode": "stage", "persona": "auto"}).json()
    assert s["stage"] == "screen" and s["persona"] == "friendly"
    qs = s["state"]["queue"]
    assert qs[0]["ref"] == "core:tell_me" and sum(1 for q in qs if q["kind"] == "core") >= 4
    s2 = c.post("/api/interview/start", json={"claims": [], "gap_items": [], "mode": "core"}).json()
    assert all(q["kind"] == "core" for q in s2["state"]["queue"])
    state = s2["state"]
    r = c.post("/api/interview/answer", json={"session_id": s2["session_id"], "state": state, "answer": "Whatever."}).json()
    assert r["score"]["total"] < 5 and r["score"]["fixes"]
    assert c.get("/api/history", params={"ref": "core:tell_me"}).json()["attempts"]


def test_plan_schedules_to_date_pins_mocks_and_triages():
    tasks = [{"id": f"t{i}", "title": f"Task {i}", "minutes": 30, "page": "board", "priority": i, "detail": ""} for i in range(8)]
    today = date(2026, 10, 1)
    s = plan_svc.schedule(tasks, 3, set(), today)
    assert s["horizon"] == 3 and s["triage"] and s["later_count"] > 0
    mocks = [t for t in s["tasks"] if t["id"].startswith("mock:")]
    assert mocks and max(t["day"] for t in mocks) == 2 and any(t["id"] == "brief" for t in s["tasks"])
    assert all(t["due"] for t in s["tasks"] if t["day"] is not None)
    roomy = plan_svc.schedule(tasks, 14, set(), today)
    assert not roomy["triage"]
    done = plan_svc.schedule(tasks, 14, {"t0"}, today)
    assert [t for t in done["tasks"] if t["id"] == "t0"][0]["done"]


def test_plan_toggle_persists_and_today_returns_tasks():
    c = client()
    c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    tasks = c.get("/api/today").json()["plan"]["tasks"]
    real = [t for t in tasks if not t["id"].startswith("mock:")][0]
    c.post("/api/plan/toggle", json={"task_id": real["id"], "done": True})
    assert [t for t in c.get("/api/today").json()["plan"]["tasks"] if t["id"] == real["id"]][0]["done"]
