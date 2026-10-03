"""FastAPI backend. On Vercel this file is the Python function; locally: uvicorn api.index:app."""
import os
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from interview_ready.claims import OWNERSHIP_LEVELS, Claim, build_questions, extract_claims  # noqa: E402
from interview_ready.db import Store, SupabaseStore  # noqa: E402
from interview_ready.gaps import analyse_gaps, gap_questions  # noqa: E402
from interview_ready.interview import build_queue, start_state, step  # noqa: E402
from interview_ready.parsing import extract_text  # noqa: E402

MAX_UPLOAD = 4 * 1024 * 1024
HOSTED = bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
app = FastAPI(title="Interview Ready", docs_url=None, redoc_url=None)
_store = None


def get_store():
    """Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, else local SQLite."""
    global _store
    if _store is None:
        _store = SupabaseStore() if HOSTED else Store()
    return _store


class ClaimIn(BaseModel):
    text: str
    type: str
    numbers: list = []
    ownership: str = "Contributed"


class ClaimsIn(BaseModel):
    claims: list[ClaimIn]


class StartIn(BaseModel):
    claims: list[ClaimIn]
    gap_questions: list[str] = []
    notes: str = ""


class AnswerIn(BaseModel):
    session_id: int
    state: dict
    answer: str


def _claim_out(c: Claim) -> dict:
    return asdict(c)


def _to_claims(items) -> list:
    out = []
    for i in items:
        own = i.ownership if i.ownership in OWNERSHIP_LEVELS else "Contributed"
        c = Claim(text=i.text, type=i.type, numbers=i.numbers, ownership=own)
        c.questions = build_questions(c)
        out.append(c)
    return out


@app.get("/api/health")
def health():
    return {"ok": True, "hosted": HOSTED}


@app.post("/api/analyze")
async def analyze(
    cv: UploadFile | None = File(default=None),
    jd_text: str = Form(default=""),
    jd: UploadFile | None = File(default=None),
    store=Depends(get_store),
):
    cv_text = None
    if cv is not None:
        data = await cv.read()
        if len(data) > MAX_UPLOAD:
            raise HTTPException(413, "CV too large (max 4 MB)")
        try:
            cv_text = extract_text(cv.filename or "cv.txt", data)
        except ValueError as e:
            raise HTTPException(400, str(e))
        store.add_document("cv", cv.filename or "cv", cv_text)
    else:
        doc = store.latest_document("cv")
        cv_text = doc["text"] if doc else None
    if not cv_text or not cv_text.strip():
        raise HTTPException(400, "Upload a CV with readable text")
    jd_body = jd_text.strip()
    if jd is not None:
        try:
            jd_body = extract_text(jd.filename or "jd.txt", await jd.read())
        except ValueError as e:
            raise HTTPException(400, str(e))
    if jd_body:
        store.add_document("jd", "jd", jd_body)
    claims = extract_claims(cv_text)
    store.replace_claims(None, claims)
    gaps = analyse_gaps(cv_text, jd_body) if jd_body else []
    return {
        "claims": [_claim_out(c) for c in claims],
        "gaps": [asdict(g) for g in gaps],
        "gap_questions": gap_questions(gaps),
    }


@app.post("/api/claims/questions")
def claim_questions(body: ClaimsIn):
    return {"claims": [_claim_out(c) for c in _to_claims(body.claims)]}


@app.post("/api/interview/start")
def interview_start(body: StartIn, store=Depends(get_store)):
    queue = build_queue(_to_claims(body.claims), body.gap_questions)
    if not queue:
        raise HTTPException(400, "No questions could be built from this CV")
    return {"session_id": store.new_session(notes=body.notes), "state": start_state(queue)}


@app.post("/api/interview/answer")
def interview_answer(body: AnswerIn, store=Depends(get_store)):
    if not body.state.get("current"):
        raise HTTPException(400, "Interview already finished")
    cur = body.state["current"]
    score, new_state = step(body.state, body.answer)
    store.save_answer(body.session_id, cur["question"], cur["kind"], body.answer, score)
    return {"score": asdict(score), "state": new_state, "done": new_state["current"] is None}


@app.get("/api/profile")
def profile(store=Depends(get_store)):
    return {"sessions": store.session_summaries(), "weaknesses": store.weaknesses()}


@app.get("/api/export")
def export(store=Depends(get_store)):
    return store.export_all()


@app.delete("/api/data")
def delete_data(store=Depends(get_store)):
    store.delete_all()
    return {"deleted": True}
