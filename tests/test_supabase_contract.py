"""Run the main flows against SupabaseStore (fake PostgREST) and against SQLite, and require the same outcomes."""
import os

import pytest

os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

from api import index  # noqa: E402
from interview_ready.db import Store, SupabaseStore  # noqa: E402
from tests.fake_postgrest import FakePostgREST  # noqa: E402

CV = (b"Head of TA\n- Reduced time to hire from 62 to 38 days across 120 roles\n- Led a team of 8 recruiters and managed a $1.2M agency budget\n")
JD = "- Strong P&L ownership and commercial acumen\n- Proven experience reducing time to hire\n"
GOOD = ("The baseline was 62 days measured in our ATS. First, I rebuilt sourcing. Second, I automated screening. Third, I trained managers. "
        "For example, automation saved 11 days across 120 roles. The result was about $0.4M a year in vacancy cost.")


@pytest.fixture(params=["sqlite", "supabase"])
def c(request):
    if request.param == "sqlite":
        index._store = Store(":memory:")
        index._fake = None
    else:
        fake = FakePostgREST()
        index._store = SupabaseStore("https://example.supabase.co", "service-key", transport=fake.transport())
        index._fake = fake
    return TestClient(index.app)


def test_core_flow_is_identical_on_both_backends(c):
    r = c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["claims"] and body["gaps"]
    ws = c.get("/api/workspace").json()
    assert ws["has_cv"] and ws["gaps"]

    c.post("/api/claims/ownership", json={"text": body["claims"][0]["text"], "ownership": "Led"})
    assert c.get("/api/workspace").json()["claims"][0]["ownership"] == "Led"

    s = c.post("/api/interview/start", json={"claims": body["claims"], "gap_items": body["gap_items"], "focus": body["claims"][0]["text"]}).json()
    state = s["state"]
    for _ in range(4):
        if not state["current"]:
            break
        state = c.post("/api/interview/answer", json={"session_id": s["session_id"], "state": state, "answer": GOOD}).json()["state"]
    prof = c.get("/api/profile").json()
    assert prof["answers"] >= 1 and prof["sessions"] and prof["refs"][body["claims"][0]["text"]]["attempts"] >= 1
    assert c.get("/api/history", params={"ref": body["claims"][0]["text"]}).json()["attempts"]

    assert c.get("/api/cv-review").json()["versions"]
    assert c.get("/api/training").json()["plan"]
    c.post("/api/training/complete", json={"lesson_id": "structure", "score": 7})
    assert c.get("/api/training").json()["progress"]["structure"]["best"] == 7


def test_targets_core_stories_debriefs_library_settings(c):
    c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    tid = c.post("/api/targets", json={"company": "Acme", "role": "Head of TA", "stage": "screen", "interview_date": "2030-01-10", "jd_text": JD,
                                       "research": {"what": "Hiring platform"}}).json()["id"]
    t = [x for x in c.get("/api/targets").json()["targets"] if x["id"] == tid][0]
    assert t["research"]["what"] == "Hiring platform" and t["stage"] == "screen"
    c.put(f"/api/targets/{tid}", json={"company": "Acme Inc", "role": "Head of TA", "stage": "screen", "interview_date": "2030-01-11", "jd_text": JD})
    assert [x for x in c.get("/api/targets").json()["targets"] if x["id"] == tid][0]["company"] == "Acme Inc"

    saved = c.put("/api/core/answer", json={"question_id": "salary", "text": "Based on the scope and the 31% agency saving I delivered, I am targeting between 145 and 155 total, and I am open to discussing the full package."}).json()
    assert saved["ready"]
    c.put("/api/core/answer", json={"question_id": "salary", "text": "Between 150 and 160 total, open to discussing the package and the scope of the role in more detail."})
    prepared = [q for q in c.get("/api/core").json()["questions"] if q.get("prepared")]
    assert len(prepared) == 1  # upsert, not a duplicate row

    fields = {"context": "In 2023 at Acme", "problem": "Agency spend 40% over budget", "action": "I cut suppliers from 14 to 3", "result": "Spend fell 31%", "impact": "Saved $380k a year"}
    sid = c.post("/api/stories", json={"theme": "commercial", "title": "A", "fields": fields}).json()["id"]
    c.post("/api/stories", json={"id": sid, "theme": "commercial", "title": "B", "fields": fields})
    assert [s["title"] for s in c.get("/api/stories").json()["stories"]] == ["B"]

    d = c.post("/api/debriefs", json={"company": "Acme", "questions": [{"question": "P&L case?", "struggled": True}]}).json()["id"]
    c.post(f"/api/debriefs/{d}/outcome", json={"outcome": "offer"})
    assert c.get("/api/debriefs").json()["stats"]["offers"] == 1

    lid = c.post("/api/library", json={"question": "Q?", "text": "Note"}).json()["id"]
    c.post(f"/api/library/{lid}/approve", json={"approved": True})
    assert c.get("/api/library").json()["items"][0]["approved"] is True
    assert index._store.find_approved("Q?") == "Note"

    c.post("/api/plan/toggle", json={"task_id": "x", "done": True})
    assert "x" in c.post("/api/plan/toggle", json={"task_id": "y", "done": True}).json()["done"]

    c.delete("/api/data")
    assert c.get("/api/profile").json()["answers"] == 0 and not c.get("/api/stories").json()["stories"] and not c.get("/api/debriefs").json()["items"]


def test_supabase_never_sends_unfiltered_delete_or_service_key_to_client(c):
    c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    c.delete("/api/data")
    fake = getattr(index, "_fake", None)
    if fake:
        assert all(m != "DELETE" or p for m, _, p in fake.log)
    assert "service-key" not in c.get("/api/targets").text and "service-key" not in c.get("/api/ai").text
