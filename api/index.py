"""FastAPI backend. On Vercel this file is the Python function; locally: uvicorn api.index:app."""
import os
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from interview_ready.claims import OWNERSHIP_LEVELS, Claim, build_questions, extract_claims  # noqa: E402
from interview_ready import ai as ai_layer, config  # noqa: E402
from interview_ready.coach import coach_note  # noqa: E402
from interview_ready.cv_analysis import analyse_cv
from interview_ready.db import Store, SupabaseStore  # noqa: E402
from interview_ready.gaps import analyse_gaps, gap_items  # noqa: E402
from interview_ready.brief import build_brief
from interview_ready.interview import build_queue, notes_plan, persona_plan, start_state, step
from interview_ready import speech, stories as story_bank
from interview_ready.spaced import due_items
from interview_ready.llm_provider import LLMUnavailable, get_provider  # noqa: E402
from interview_ready.parsing import extract_text  # noqa: E402
from interview_ready import training  # noqa: E402

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
    keywords: list = []


class OwnershipIn(BaseModel):
    text: str
    ownership: str


class LibraryIn(BaseModel):
    kind: str = "feedback"
    question: str
    text: str


class ApproveIn(BaseModel):
    approved: bool = True


class ClaimsIn(BaseModel):
    claims: list[ClaimIn]


class GapItem(BaseModel):
    question: str
    ref: str


class StartIn(BaseModel):
    claims: list[ClaimIn]
    gap_items: list[GapItem] = []
    notes: str = ""
    focus: str = ""
    max_questions: int = 6
    persona: str = "standard"


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
        c = Claim(text=i.text, type=i.type, numbers=i.numbers, ownership=own, keywords=i.keywords)
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
        "gap_items": gap_items(gaps),
    }


@app.post("/api/claims/ownership")
def claim_ownership(body: OwnershipIn, store=Depends(get_store)):
    if body.ownership not in OWNERSHIP_LEVELS:
        raise HTTPException(400, "Unknown ownership level")
    store.set_ownership(body.text, body.ownership)
    return {"ok": True}


@app.post("/api/claims/questions")
def claim_questions(body: ClaimsIn):
    return {"claims": [_claim_out(c) for c in _to_claims(body.claims)]}


@app.post("/api/interview/start")
def interview_start(body: StartIn, store=Depends(get_store)):
    npl = notes_plan(body.notes) if not body.focus else {"extras": [], "max_followups": 1}
    per = persona_plan(body.persona)
    plan = {"extras": (per["extras"] + npl["extras"])[:3], "max_followups": max(npl["max_followups"], per["max_followups"])}
    items = plan["extras"] + [g.model_dump() for g in body.gap_items]
    queue = build_queue(_to_claims(body.claims), items, min(max(body.max_questions, 1), 10), body.focus)
    if not queue:
        raise HTTPException(400, "No questions could be built from this CV")
    return {"session_id": store.new_session(notes=body.notes), "state": start_state(queue, len(queue), plan["max_followups"], per["phrases"], per["id"])}


@app.post("/api/interview/answer")
def interview_answer(body: AnswerIn, store=Depends(get_store)):
    if not body.state.get("current"):
        raise HTTPException(400, "Interview already finished")
    cur = body.state["current"]
    score, new_state = step(body.state, body.answer)
    store.save_answer(body.session_id, cur["question"], cur["kind"], body.answer, score, cur.get("ref", ""))
    return {"score": asdict(score), "state": new_state, "done": new_state["current"] is None,
            "coach": _coach(store, cur["question"], body.answer, score)}


class CheckIn(BaseModel):
    kind: str  # rewrite | build
    lesson_id: str = ""
    original: str = ""
    text: str = ""
    values: dict = {}


class CompleteIn(BaseModel):
    lesson_id: str
    score: float


def _context(store):
    cv, jd = store.latest_document("cv"), store.latest_document("jd")
    if not cv:
        return None, []
    return cv["text"], (analyse_gaps(cv["text"], jd["text"]) if jd else [])


@app.get("/api/cv-review")
def cv_review(store=Depends(get_store)):
    cv_text, gaps = _context(store)
    if not cv_text:
        return {"has_cv": False}
    review = analyse_cv(cv_text)
    versions = [{"id": d["id"], "name": d.get("name") or "CV", "created": str(d["created"]), "score": analyse_cv(d["text"])["score"]}
                for d in store.list_documents("cv")]
    return {"has_cv": True, "review": review, "plan": training.build_plan(review, gaps, store.profile()), "versions": versions}


@app.get("/api/training")
def training_overview(store=Depends(get_store)):
    cv_text, gaps = _context(store)
    review = analyse_cv(cv_text) if cv_text else None
    claims = extract_claims(cv_text) if cv_text else []
    prof = store.profile()
    plan = training.build_plan(review, gaps, prof) if review else []
    metric = next((c.text for c in claims if c.type == "metric"), claims[0].text if claims else "")
    return {
        "has_cv": bool(cv_text), "lessons": training.lessons(), "quizzes": training.preset("lessons")["quizzes"], "plan": plan,
        "progress": store.training_progress(),
        "rewrite_bullets": review["bullets_to_fix"] if review else [],
        "claim": claims[0].text if claims else "", "metric": metric,
        "resources": training.recommend_resources(prof.get("dims", {}), plan),
    }


@app.post("/api/training/check")
def training_check(body: CheckIn):
    if body.kind == "rewrite":
        if not body.text.strip():
            raise HTTPException(400, "Write your rewrite first")
        return training.check_rewrite(body.original, body.text)
    if body.kind == "pressure":
        return training.check_pressure(body.lesson_id, body.text)
    if body.kind == "build":
        try:
            return training.check_build(body.lesson_id, body.values)
        except KeyError:
            raise HTTPException(404, "Unknown lesson")
    raise HTTPException(400, "Unknown check kind")


@app.post("/api/training/complete")
def training_complete(body: CompleteIn, store=Depends(get_store)):
    if body.lesson_id not in training.lesson_map() and body.lesson_id != "pressure_drill":
        raise HTTPException(404, "Unknown lesson")
    store.record_training(body.lesson_id, body.score)
    return {"progress": store.training_progress()}


def _provider(store=None):
    """Groq when opted in for coaching, else local Ollama, else None (rules only)."""
    if store is not None:
        p = ai_layer.provider_for(store, "coaching")
        if p:
            return p
    if config.LLM_BACKEND == "off":
        return None
    try:
        return get_provider(store_cache())
    except LLMUnavailable:
        return None


def store_cache():
    return _store if isinstance(_store, Store) else None


def _coach(store, question, answer, score):
    try:
        return coach_note(question, answer, score.dims, score.fixes, store, _provider(store))
    except Exception:  # model problems must never break scoring
        return None


class AiSettingsIn(BaseModel):
    enabled: bool
    consent: bool = False
    features: dict | None = None


class StoryTightenIn(BaseModel):
    theme: str
    fields: dict


def _ai_guard(fn):
    """Map AI-layer failures to clear HTTP errors. Never echo content."""
    try:
        return fn()
    except ai_layer.AIDisabled as e:
        raise HTTPException(403, str(e))
    except ai_layer.AILimit as e:
        raise HTTPException(429, str(e))
    except ai_layer.AIBadOutput as e:
        raise HTTPException(502, f"The AI reply could not be used ({e}). Try again; your rule-based results are unaffected.")
    except LLMUnavailable as e:
        raise HTTPException(503, str(e))
    except KeyError:
        raise HTTPException(404, "Unknown item")


@app.get("/api/ai")
def ai_status(store=Depends(get_store)):
    return ai_layer.status(store)


@app.post("/api/ai/settings")
def ai_settings(body: AiSettingsIn, store=Depends(get_store)):
    return _ai_guard(lambda: ai_layer.save_settings(store, body.enabled, body.consent, body.features))


@app.get("/api/ai/preview")
def ai_preview(store=Depends(get_store)):
    cv_text, _ = _context(store)
    if not cv_text:
        raise HTTPException(400, "Upload a CV first")
    r = ai_layer.preview(cv_text)
    return {"text": r["text"], "removed": r["removed"], "total": r["total"]}


@app.post("/api/ai/cv-review")
def ai_cv_review_ep(store=Depends(get_store)):
    cv, jd = store.latest_document("cv"), store.latest_document("jd")
    if not cv:
        raise HTTPException(400, "Upload a CV first")
    return _ai_guard(lambda: ai_layer.ai_cv_review(store, cv["text"], jd["text"] if jd else ""))


@app.post("/api/ai/questions")
def ai_questions_ep(store=Depends(get_store)):
    cv, jd = store.latest_document("cv"), store.latest_document("jd")
    if not cv:
        raise HTTPException(400, "Upload a CV first")
    return {"questions": _ai_guard(lambda: ai_layer.ai_questions(store, cv["text"], jd["text"] if jd else ""))}


@app.post("/api/ai/story-tighten")
def ai_story_ep(body: StoryTightenIn, store=Depends(get_store)):
    return _ai_guard(lambda: ai_layer.ai_tighten_story(store, body.theme, body.fields))


@app.get("/api/llm")
def llm_status():
    return {"backend": config.LLM_BACKEND}


@app.get("/api/library")
def library(store=Depends(get_store)):
    return {"items": store.list_library()}


@app.post("/api/library")
def library_add(body: LibraryIn, store=Depends(get_store)):
    return {"id": store.add_library(body.kind, body.question, body.text)}


@app.post("/api/library/{item_id}/approve")
def library_approve(item_id: int, body: ApproveIn, store=Depends(get_store)):
    store.approve_library(item_id, body.approved)
    return {"ok": True}


@app.delete("/api/library/{item_id}")
def library_delete(item_id: int, store=Depends(get_store)):
    store.delete_library(item_id)
    return {"ok": True}


@app.get("/api/profile")
def profile(store=Depends(get_store)):
    p = store.profile()
    p["due"] = due_items(p["refs"])
    return p


@app.get("/api/personas")
def personas():
    from interview_ready.config import preset
    return {"personas": [{k: v for k, v in x.items() if k in ("id", "label", "blurb")} for x in preset("personas")["personas"]]}


@app.get("/api/drills/pressure")
def pressure_drill(store=Depends(get_store)):
    from interview_ready.config import preset
    cv_text, _ = _context(store)
    claims = [c for c in extract_claims(cv_text) if c.type == "metric"] if cv_text else []
    phrases = preset("pressure")
    rounds = []
    for i, key in enumerate(training.PRESSURE_ROUNDS):
        claim = claims[i % len(claims)].text if claims else "your strongest result at your last role"
        rounds.append({"key": key, "challenge": phrases[key], "claim": claim, "seconds": 45})
    return {"rounds": rounds}


@app.get("/api/interview-brief")
def interview_brief(store=Depends(get_store)):
    cv, jd = store.latest_document("cv"), store.latest_document("jd")
    if not cv:
        return {"has_cv": False}
    claims = extract_claims(cv["text"])
    gaps = analyse_gaps(cv["text"], jd["text"]) if jd else []
    return {"has_cv": True, **build_brief(cv["text"], jd["text"] if jd else "", gaps, claims, store.profile())}


class StoryIn(BaseModel):
    id: int | None = None
    theme: str
    title: str = ""
    fields: dict


@app.get("/api/stories")
def stories_list(store=Depends(get_store)):
    items = store.list_stories()
    return {"themes": story_bank.themes(), "stories": items, "coverage": story_bank.coverage(items)}


@app.post("/api/stories/check")
def stories_check(body: StoryIn):
    try:
        return story_bank.check_story(body.theme, body.fields)
    except KeyError:
        raise HTTPException(404, "Unknown theme")


@app.post("/api/stories")
def stories_save(body: StoryIn, store=Depends(get_store)):
    try:
        res = story_bank.check_story(body.theme, body.fields)
    except KeyError:
        raise HTTPException(404, "Unknown theme")
    sid = store.save_story(body.id, body.theme, body.title.strip(), body.fields, res["composed"], res["score"])
    return {"id": sid, "check": res}


@app.delete("/api/stories/{story_id}")
def stories_delete(story_id: int, store=Depends(get_store)):
    store.delete_story(story_id)
    return {"ok": True}


class DebriefIn(BaseModel):
    company: str = ""
    role: str = ""
    interview_date: str = ""
    outcome: str = "pending"
    notes: str = ""
    questions: list[dict] = []


class OutcomeIn(BaseModel):
    outcome: str
    notes: str = ""


OUTCOMES = ("pending", "offer", "rejected", "withdrawn")


@app.get("/api/debriefs")
def debriefs_list(store=Depends(get_store)):
    items = store.list_debriefs()
    done = [d for d in items if d["outcome"] != "pending"]
    return {"items": items, "stats": {"interviews": len(items), "offers": sum(1 for d in items if d["outcome"] == "offer"),
                                      "decided": len(done)}}


@app.post("/api/debriefs")
def debriefs_add(body: DebriefIn, store=Depends(get_store)):
    if body.outcome not in OUTCOMES:
        raise HTTPException(400, "Unknown outcome")
    qs = [{"question": q.get("question", "").strip(), "struggled": bool(q.get("struggled")), "notes": q.get("notes", "")}
          for q in body.questions if q.get("question", "").strip()]
    return {"id": store.add_debrief(body.company, body.role, body.interview_date, body.outcome, body.notes, qs)}


@app.post("/api/debriefs/{debrief_id}/outcome")
def debriefs_outcome(debrief_id: int, body: OutcomeIn, store=Depends(get_store)):
    if body.outcome not in OUTCOMES:
        raise HTTPException(400, "Unknown outcome")
    store.update_debrief(debrief_id, body.outcome, body.notes)
    return {"ok": True}


@app.delete("/api/debriefs/{debrief_id}")
def debriefs_delete(debrief_id: int, store=Depends(get_store)):
    store.delete_debrief(debrief_id)
    return {"ok": True}


@app.get("/api/voice")
def voice_status():
    return {"available": (not HOSTED) and speech.available()}


@app.post("/api/voice/transcribe")
async def voice_transcribe(audio: UploadFile = File(...)):
    if HOSTED or not speech.available():
        raise HTTPException(501, "Voice runs only on a local install with faster-whisper (pip install -r requirements-voice.txt)")
    data = await audio.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "Recording too large")
    words = speech.transcribe(data)  # audio is processed in memory and never stored
    m = speech.speech_metrics(words)
    return {"text": " ".join(w["word"] for w in words), "metrics": m, "coaching": speech.coaching(m)}


@app.get("/api/workspace")
def workspace(store=Depends(get_store)):
    """Rebuild the latest analysis from stored CV/JD so a reload resumes where you left off."""
    cv = store.latest_document("cv")
    if not cv:
        return {"has_cv": False}
    jd = store.latest_document("jd")
    claims = extract_claims(cv["text"])
    saved = store.get_ownerships()
    for c in claims:
        if saved.get(c.text) in OWNERSHIP_LEVELS:
            c.ownership = saved[c.text]
            c.questions = build_questions(c)
    gaps = analyse_gaps(cv["text"], jd["text"]) if jd else []
    return {"has_cv": True, "cv_name": cv.get("name") or "CV", "has_jd": bool(jd),
            "claims": [_claim_out(c) for c in claims], "gaps": [asdict(g) for g in gaps],
            "gap_items": gap_items(gaps)}


@app.get("/api/export")
def export(store=Depends(get_store)):
    return store.export_all()


@app.delete("/api/data")
def delete_data(store=Depends(get_store)):
    store.delete_all()
    return {"deleted": True}
