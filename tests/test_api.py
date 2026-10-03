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
