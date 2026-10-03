import os

os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

from api import index  # noqa: E402
from interview_ready.db import Store  # noqa: E402

CV = b"Head of TA\n- Reduced time to hire from 62 to 38 days across 120 roles\n- Led a team of 8 recruiters\n"
JD = "- Strong P&L ownership and commercial acumen\n- Proven experience reducing time to hire\n"


def client():
    index._store = Store(":memory:")
    return TestClient(index.app)


def test_full_flow():
    c = client()
    r = c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["claims"] and body["gaps"]
    r = c.post("/api/interview/start", json={"claims": body["claims"], "gap_items": body["gap_items"]})
    assert r.status_code == 200
    sid, state = r.json()["session_id"], r.json()["state"]
    for _ in range(12):
        r = c.post("/api/interview/answer", json={"session_id": sid, "state": state, "answer": "We did some things."})
        assert r.status_code == 200
        state = r.json()["state"]
        if r.json()["done"]:
            break
    assert r.json()["done"]
    prof = c.get("/api/profile").json()
    assert prof["sessions"] and prof["dims"] and prof["answers"] > 0
    ws = c.get("/api/workspace").json()
    assert ws["has_cv"] and ws["claims"]
    assert c.get("/api/export").json()["answers"]
    assert c.delete("/api/data").json()["deleted"]
    assert not c.get("/api/profile").json()["sessions"]


def test_bad_upload_type():
    r = client().post("/api/analyze", files={"cv": ("cv.exe", b"x")})
    assert r.status_code == 400


def test_workspace_empty():
    assert client().get("/api/workspace").json() == {"has_cv": False}


def test_focus_drill_and_claim_status():
    c = client()
    body = c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD}).json()
    claim = body["claims"][0]["text"]
    r = c.post("/api/interview/start", json={"claims": body["claims"], "gap_items": body["gap_items"], "focus": claim})
    state = r.json()["state"]
    assert len(state["queue"]) > 1 and all(q["ref"] == claim for q in state["queue"])
    c.post("/api/interview/answer", json={"session_id": r.json()["session_id"], "state": state, "answer": "We did things."})
    refs = c.get("/api/profile").json()["refs"]
    assert refs[claim]["attempts"] >= 1
    assert c.get("/api/profile").json()["sessions"][0]["dims"]


def test_cv_review_training_flow():
    c = client()
    assert c.get("/api/cv-review").json() == {"has_cv": False}
    c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    r = c.get("/api/cv-review").json()
    assert r["has_cv"] and r["review"]["score"] >= 0 and r["plan"]
    t = c.get("/api/training").json()
    assert t["lessons"] and t["plan"] and t["claim"]
    chk = c.post("/api/training/check", json={"kind": "rewrite", "original": "Worked on hiring", "text": "Cut time to hire from 62 to 38 days"})
    assert chk.status_code == 200 and chk.json()["improved"]
    assert c.post("/api/training/check", json={"kind": "build", "lesson_id": "nope"}).status_code == 404
    done = c.post("/api/training/complete", json={"lesson_id": "structure", "score": 7.5}).json()
    assert done["progress"]["structure"]["attempts"] == 1
    assert c.get("/api/training").json()["progress"]["structure"]["best"] == 7.5
    c.delete("/api/data")
    assert not c.get("/api/training").json()["progress"]


def test_ownership_persists_and_library_first_coach(monkeypatch):
    c = client()
    body = c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD}).json()
    text = body["claims"][0]["text"]
    assert c.post("/api/claims/ownership", json={"text": text, "ownership": "Led"}).status_code == 200
    assert c.post("/api/claims/ownership", json={"text": text, "ownership": "Nope"}).status_code == 400
    ws = c.get("/api/workspace").json()
    assert next(x for x in ws["claims"] if x["text"] == text)["ownership"] == "Led"

    start = c.post("/api/interview/start", json={"claims": body["claims"], "gap_items": body["gap_items"],
                                                 "notes": "CEO, tough and blunt"}).json()
    assert start["state"]["max_followups"] == 2
    q = start["state"]["current"]["question"]
    lid = c.post("/api/library", json={"question": q, "text": "Name the baseline first."}).json()["id"]
    r = c.post("/api/interview/answer", json={"session_id": start["session_id"], "state": start["state"], "answer": "We did things."}).json()
    assert r["coach"] is None
    c.post(f"/api/library/{lid}/approve", json={"approved": True})
    start2 = c.post("/api/interview/start", json={"claims": body["claims"], "gap_items": body["gap_items"], "notes": "CEO, tough and blunt"}).json()
    q2 = start2["state"]["current"]["question"]
    c.post("/api/library", json={"question": q2, "text": "Lead with the number."})
    item = [i for i in c.get("/api/library").json()["items"] if i["question"] == q2][0]
    c.post(f"/api/library/{item['id']}/approve", json={"approved": True})
    r2 = c.post("/api/interview/answer", json={"session_id": start2["session_id"], "state": start2["state"], "answer": "We did things."}).json()
    assert r2["coach"] == {"text": "Lead with the number.", "source": "library"}
    c.delete(f"/api/library/{item['id']}")
    assert all(i["id"] != item["id"] for i in c.get("/api/library").json()["items"])


def test_stories_debriefs_brief_personas_pressure():
    c = client()
    body = c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD}).json()

    fields = {"context": "In 2023 at Acme", "problem": "Agency spend 40% over budget", "action": "I cut suppliers from 14 to 3",
              "result": "Spend fell 31%", "impact": "Saved $380k a year"}
    saved = c.post("/api/stories", json={"theme": "commercial", "title": "Agency consolidation", "fields": fields}).json()
    assert saved["check"]["ready"]
    s = c.get("/api/stories").json()
    assert s["coverage"]["core_ready"] == 1 and s["stories"][0]["title"] == "Agency consolidation"
    c.post("/api/stories", json={"id": saved["id"], "theme": "commercial", "title": "Renamed", "fields": fields})
    assert c.get("/api/stories").json()["stories"][0]["title"] == "Renamed"
    assert c.post("/api/stories/check", json={"theme": "nope", "fields": {}}).status_code == 404
    c.delete(f"/api/stories/{saved['id']}")
    assert c.get("/api/stories").json()["stories"] == []

    d = c.post("/api/debriefs", json={"company": "Acme", "role": "Head of TA", "questions": [{"question": "Walk me through your P&L", "struggled": True}]}).json()
    c.post(f"/api/debriefs/{d['id']}/outcome", json={"outcome": "offer"})
    ds = c.get("/api/debriefs").json()
    assert ds["stats"] == {"interviews": 1, "offers": 1, "decided": 1} and ds["items"][0]["questions"][0]["struggled"]
    assert c.post(f"/api/debriefs/{d['id']}/outcome", json={"outcome": "bad"}).status_code == 400

    start = c.post("/api/interview/start", json={"claims": body["claims"], "gap_items": body["gap_items"], "persona": "aggressive"}).json()
    assert start["state"]["max_followups"] == 2 and start["state"]["persona"] == "aggressive"
    r = c.post("/api/interview/answer", json={"session_id": start["session_id"], "state": start["state"], "answer": "We did some things."}).json()
    assert r["state"]["current"]["kind"] == "followup"
    assert r["state"]["current"]["question"] in ("Stop. I've lost you. Thirty seconds.", "That was 'we' again. What did YOU do?") or "Numbers" in r["state"]["current"]["question"] or "one sentence" in r["state"]["current"]["question"].lower() or "vague" in r["state"]["current"]["question"].lower() or "So what" in r["state"]["current"]["question"]
    assert any(p["id"] == "ceo" for p in c.get("/api/personas").json()["personas"])

    pr = c.get("/api/drills/pressure").json()["rounds"]
    assert len(pr) == 6 and pr[0]["claim"]
    ok = c.post("/api/training/check", json={"kind": "pressure", "lesson_id": "no_numbers", "text": "Cut time to hire by 39%."}).json()
    bad = c.post("/api/training/check", json={"kind": "pressure", "lesson_id": "no_numbers", "text": "A lot, honestly."}).json()
    assert ok["pass"] and not bad["pass"]

    b = c.get("/api/interview-brief").json()
    assert b["has_cv"] and b["claims_to_defend"] and b["likely_questions"] and b["pitch"]["draft"] and b["ask_them"]
    t = c.get("/api/training").json()
    assert "resources" in t and any(l["id"] == "salary" for l in t["lessons"])
    assert c.get("/api/voice").json() == {"available": False} or c.get("/api/voice").json()["available"] in (True, False)


def test_spaced_repetition_due_items():
    from datetime import datetime, timedelta, timezone
    from interview_ready.spaced import due_items
    now = datetime(2026, 10, 10, tzinfo=timezone.utc)
    refs = {
        "shaky recent": {"attempts": 2, "last": 4, "best": 4, "last_at": (now - timedelta(days=3)).isoformat()},
        "shaky fresh": {"attempts": 1, "last": 4, "best": 4, "last_at": now.isoformat()},
        "solid recent": {"attempts": 1, "last": 9, "best": 9, "last_at": (now - timedelta(days=1)).isoformat()},
        "solid old": {"attempts": 1, "last": 9, "best": 9, "last_at": (now - timedelta(days=5)).isoformat()},
    }
    due = {d["ref"]: d for d in due_items(refs, now)}
    assert "shaky recent" in due and "solid old" in due
    assert "solid recent" not in due
    assert due["shaky fresh"]["state"] == "shaky"  # 0-day interval: shaky items are due immediately
    assert list(due)[0].startswith("shaky")


def test_speech_metrics_pure():
    from interview_ready.speech import coaching, speech_metrics
    words = [{"word": "So", "start": 0, "end": 0.3}, {"word": "um", "start": 0.4, "end": 0.6}, {"word": "we", "start": 2.5, "end": 2.7},
             {"word": "cut", "start": 2.8, "end": 3.0}]
    m = speech_metrics(words)
    assert m["pause_count"] == 1 and m["fillers"] == {"um": 1} and m["words"] == 4
    assert any("Filler" in x for x in coaching(m))


def test_ai_endpoints_gating_and_flow(monkeypatch):
    from interview_ready import ai as ai_layer
    from interview_ready.llm_provider import LLMProvider

    c = client()
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD})
    assert c.get("/api/ai").json()["configured"] is False
    assert c.post("/api/ai/settings", json={"enabled": True, "consent": False}).status_code == 403
    assert c.post("/api/ai/cv-review").status_code == 403  # not enabled

    prev = c.get("/api/ai/preview").json()
    assert "text" in prev and prev["total"] >= 0

    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    st = c.post("/api/ai/settings", json={"enabled": True, "consent": True, "features": {"coaching": False}}).json()
    assert st["enabled"] and st["configured"] and st["features"]["coaching"] is False

    class Fake(LLMProvider):
        def complete(self, prompt, system="", json_mode=False):
            import json
            return json.dumps({"seniority": "Senior", "summary": "ok", "risks": ["r"], "rewrites": [], "hard_questions": ["q?"], "missing_evidence": []})

    monkeypatch.setattr(ai_layer, "GroqProvider", lambda: Fake())
    r = c.post("/api/ai/cv-review")
    assert r.status_code == 200 and r.json()["seniority"] == "Senior"
    assert c.get("/api/ai").json()["used_today"] == 1
    assert c.post("/api/ai/story-tighten", json={"theme": "nope", "fields": {}}).status_code == 404


def test_cv_review_versions_after_reupload():
    c = client()
    c.post("/api/analyze", files={"cv": ("v1.txt", CV)}, data={"jd_text": JD})
    c.post("/api/analyze", files={"cv": ("v2.txt", CV + b"- Cut agency spend by 31% across 8 suppliers\n")})
    v = c.get("/api/cv-review").json()["versions"]
    assert [x["name"] for x in v] == ["v1.txt", "v2.txt"] and all("score" in x for x in v)


def test_ai_grade_caps_dodged_answers_and_probes(monkeypatch):
    import json
    from interview_ready import ai as ai_layer
    from interview_ready.llm_provider import LLMProvider

    c = client()
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    body = c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD}).json()
    c.post("/api/ai/settings", json={"enabled": True, "consent": True})

    class Fake(LLMProvider):
        def complete(self, prompt, system="", json_mode=False):
            return json.dumps({"answers_question": False, "note": "You talked about hiking, not the 62 to 38 days.",
                               "follow_up": "You said the process improved. Which step saved the most days?"})

    monkeypatch.setattr(ai_layer, "GroqProvider", lambda: Fake())
    start = c.post("/api/interview/start", json={"claims": body["claims"], "gap_items": body["gap_items"]}).json()
    good = ("The baseline was 62 days measured in our ATS. First, I rebuilt sourcing. Second, I automated screening. Third, I trained managers. "
            "For example, automation saved 11 days across 120 roles. The result was about $0.4M a year in vacancy cost.")
    r = c.post("/api/interview/answer", json={"session_id": start["session_id"], "state": start["state"], "answer": good}).json()
    assert r["score"]["total"] <= 4.0 and r["score"]["fixes"][0].startswith("AI read")
    assert r["coach"]["follow_up"].startswith("You said")


def test_off_topic_answer_is_capped_by_rules_in_the_flow():
    c = client()
    body = c.post("/api/analyze", files={"cv": ("cv.txt", CV)}, data={"jd_text": JD}).json()
    start = c.post("/api/interview/start", json={"claims": body["claims"], "gap_items": body["gap_items"]}).json()
    hike = ("I love hiking. First, I plan the route carefully. Second, I check the weather forecast. Third, I pack the right gear. "
            "For example, in 2023 I hiked 12 peaks and saved $200 on equipment. The result was a great summer and better fitness.")
    r = c.post("/api/interview/answer", json={"session_id": start["session_id"], "state": start["state"], "answer": hike}).json()
    assert r["score"]["total"] <= 3.5 and "does not answer" in r["score"]["fixes"][0]


def test_access_key_gate(monkeypatch):
    c = client()
    assert c.get("/api/targets").status_code == 200  # no key configured: open (local mode)
    monkeypatch.setenv("APP_ACCESS_KEY", "s3cret-key-123456")
    assert c.get("/api/health").status_code == 200  # health stays open
    assert c.get("/api/access").json() == {"required": True, "ok": False}
    for path in ("/api/export", "/api/targets", "/api/ai", "/api/profile"):
        assert c.get(path).status_code == 401
    assert c.delete("/api/data").status_code == 401
    assert c.post("/api/ai/cv-review").status_code == 401
    bad = {"x-access-key": "nope"}
    assert c.get("/api/export", headers=bad).status_code == 401
    good = {"x-access-key": "s3cret-key-123456"}
    assert c.get("/api/access", headers=good).json() == {"required": True, "ok": True}
    assert c.get("/api/export", headers=good).status_code == 200
