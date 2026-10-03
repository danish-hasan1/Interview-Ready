"""AI layer on top of the rules. Opt-in, redacted, cached, capped, validated.
Rules always run first and own scoring. AI never invents facts: figures it adds must come from your text."""
import hashlib
import json
import os
import re
from datetime import date

from pydantic import BaseModel, ValidationError

from . import config
from .cv_analysis import review_bullet
from .llm_provider import GroqProvider, LLMProvider, LLMUnavailable
from .redact import redact_cv
from .stories import check_story, themes

FEATURES = ("cv_review", "coaching", "questions", "story")
_NUM = re.compile(r"\d[\d,.]*")


class AIDisabled(Exception):
    pass


class AILimit(Exception):
    pass


class AIBadOutput(Exception):
    pass


def key_present() -> bool:
    return bool(os.environ.get("GROQ_API_KEY"))


def status(store) -> dict:
    s = store.get_setting("ai", {}) or {}
    feats = s.get("features") or {f: True for f in FEATURES}
    used = store.usage_today(date.today().isoformat())
    return {"configured": key_present(), "enabled": bool(s.get("enabled")), "consent": bool(s.get("consent")),
            "features": {f: bool(feats.get(f, True)) for f in FEATURES}, "used_today": used,
            "cap": config.AI_DAILY_CAP or None, "provider": "Groq", "model": config.GROQ_MODEL}


def save_settings(store, enabled: bool, consent: bool, features: dict | None) -> dict:
    if enabled and not consent:
        raise AIDisabled("Consent is required before AI can be enabled")
    cur = store.get_setting("ai", {}) or {}
    store.set_setting("ai", {"enabled": enabled, "consent": consent or cur.get("consent", False),
                             "features": {f: bool((features or cur.get("features") or {}).get(f, True)) for f in FEATURES}})
    return status(store)


def is_on(store, feature: str) -> bool:
    st = status(store)
    return st["configured"] and st["enabled"] and st["consent"] and st["features"].get(feature, False)


def provider_for(store, feature: str) -> LLMProvider | None:
    return GroqProvider() if is_on(store, feature) else None


def _parse_json(raw: str) -> dict:
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s)
    try:
        d = json.loads(s)
    except ValueError:
        m = re.search(r"\{.*\}", s, re.DOTALL)
        if not m:
            raise AIBadOutput("Model did not return JSON")
        try:
            d = json.loads(m.group(0))
        except ValueError as e:
            raise AIBadOutput("Model returned malformed JSON") from e
    if not isinstance(d, dict):
        raise AIBadOutput("Model returned the wrong shape")
    return d


def call_json(store, feature: str, system: str, user: str, provider: LLMProvider | None = None) -> dict:
    """Guarded model call: opt-in check, cache, daily cap, JSON parse."""
    if provider is None:
        if not is_on(store, feature):
            raise AIDisabled("AI is off for this feature")
        provider = GroqProvider()
    key = hashlib.sha256(f"{config.GROQ_MODEL}|{system}|{user}".encode()).hexdigest()
    cached = store.get(key)
    if cached:
        return _parse_json(cached)
    day = date.today().isoformat()
    if config.AI_DAILY_CAP and store.usage_today(day) >= config.AI_DAILY_CAP:
        raise AILimit("Daily AI limit reached")
    raw = provider.complete(user, system, json_mode=True)
    store.incr_usage(day)
    d = _parse_json(raw)
    store.put(key, raw)
    return d


def _numbers(text: str) -> set:
    return {n.strip(".,").replace(",", "") for n in _NUM.findall(text or "")}


def _invented(new: str, *sources: str) -> bool:
    allowed = set().union(*[_numbers(s) for s in sources])
    return bool(_numbers(new) - allowed)


# ---------- CV review ----------
class _Rewrite(BaseModel):
    original: str
    rewrite: str
    why: str = ""


class _CvOut(BaseModel):
    seniority: str = ""
    summary: str = ""
    risks: list[str] = []
    rewrites: list[_Rewrite] = []
    hard_questions: list[str] = []
    missing_evidence: list[str] = []


CV_SYSTEM = (
    "You are a senior executive-search consultant reviewing a CV. Use ONLY facts present in the CV text. "
    "Never invent employers, dates, titles or numbers. If a rewrite needs a figure the CV does not contain, "
    "write a bracketed placeholder such as [X%] or [N roles]. Return JSON with keys: "
    "seniority (one sentence: the level this CV signals and why), summary (two sentences), "
    "risks (up to 5 strings: what an interviewer will distrust), "
    "rewrites (up to 6 objects {original, rewrite, why}; original MUST be copied verbatim from the CV), "
    "hard_questions (exactly 5 questions an interviewer would ask, each quoting a specific CV line), "
    "missing_evidence (up to 4 strings, relative to the job description when given). Be direct. No praise."
)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def preview(cv_text: str) -> dict:
    return redact_cv(cv_text)


def ai_cv_review(store, cv_text: str, jd_text: str = "", provider: LLMProvider | None = None) -> dict:
    red = redact_cv(cv_text)
    jd = redact_cv(jd_text)["text"] if jd_text else ""
    user = (f"JOB DESCRIPTION:\n{jd[:4000]}\n\n" if jd else "") + f"CV (contact details removed):\n{red['text'][:9000]}"
    raw = call_json(store, "cv_review", CV_SYSTEM, user, provider)
    try:
        out = _CvOut(**{k: raw.get(k) for k in _CvOut.model_fields if raw.get(k) is not None})
    except ValidationError as e:
        raise AIBadOutput("Model output did not match the expected shape") from e
    cv_norm = _norm(cv_text)
    keep = []
    for rw in out.rewrites[:8]:
        if _norm(rw.original) not in cv_norm:
            continue  # not a real line from the CV
        if _invented(rw.rewrite, cv_text, jd_text):
            continue  # model added a figure that is not in your CV
        before, after = review_bullet(rw.original), review_bullet(rw.rewrite.replace("[", "").replace("]", ""))
        placeholder = bool(re.search(r"\[[^\]]+\]", rw.rewrite))
        if after.score <= before.score:
            continue  # must beat the rule score to be shown
        keep.append({"original": rw.original, "rewrite": rw.rewrite, "why": rw.why, "before": before.score, "after": after.score,
                     "needs_figure": placeholder})
    return {"seniority": out.seniority, "summary": out.summary, "risks": out.risks[:5], "rewrites": keep[:6],
            "hard_questions": out.hard_questions[:5], "missing_evidence": out.missing_evidence[:4],
            "redacted": red["removed"], "dropped": max(0, len(out.rewrites) - len(keep))}


# ---------- custom questions ----------
Q_SYSTEM = (
    "You are a tough but fair interviewer. From the CV and job description, write 6 hard interview questions. "
    "Each must quote a specific CV line or job requirement it tests and be answerable with evidence. Use only facts given. "
    "Return JSON: {\"questions\": [{\"question\": str, \"about\": str}]}. 'about' is the exact CV line or requirement."
)


def ai_questions(store, cv_text: str, jd_text: str = "", provider: LLMProvider | None = None) -> list:
    red = redact_cv(cv_text)["text"]
    jd = redact_cv(jd_text)["text"] if jd_text else ""
    raw = call_json(store, "questions", Q_SYSTEM, (f"JOB DESCRIPTION:\n{jd[:4000]}\n\n" if jd else "") + f"CV:\n{red[:9000]}", provider)
    qs = raw.get("questions")
    if not isinstance(qs, list):
        raise AIBadOutput("Model returned no questions")
    out = []
    for q in qs[:8]:
        if isinstance(q, dict) and isinstance(q.get("question"), str) and len(q["question"]) > 15:
            out.append({"question": q["question"].strip(), "ref": str(q.get("about") or "AI question")[:200]})
    if not out:
        raise AIBadOutput("Model returned no usable questions")
    return out[:6]


# ---------- story tightening ----------
S_SYSTEM = (
    "You tighten interview stories. Keep every fact. Do not add or change any number, employer or date. "
    "If a figure is missing, keep the field as given. Use first person 'I' for the candidate's own decisions. "
    "Return JSON: {\"fields\": {\"context\": str, \"problem\": str, \"action\": str, \"result\": str, \"impact\": str}, \"note\": str} "
    "where note is one sentence on what you changed."
)


def ai_tighten_story(store, theme_id: str, fields: dict, provider: LLMProvider | None = None) -> dict:
    th = next((t for t in themes()["themes"] if t["id"] == theme_id), None)
    if not th:
        raise KeyError(theme_id)
    src = {k: str(v) for k, v in fields.items() if v}
    raw = call_json(store, "story", S_SYSTEM, f"Theme question: {th['prompt']}\nStory fields JSON: {json.dumps(src)}", provider)
    new = raw.get("fields")
    if not isinstance(new, dict):
        raise AIBadOutput("Model returned no story fields")
    clean = {k: str(new.get(k, src.get(k, ""))).strip() for k in ("context", "problem", "action", "result", "impact")}
    joined_src = " ".join(src.values())
    if _invented(" ".join(clean.values()), joined_src):
        raise AIBadOutput("Model changed a figure, so the suggestion was discarded")
    before, after = check_story(theme_id, src), check_story(theme_id, clean)
    return {"fields": clean, "note": str(raw.get("note", ""))[:300], "before": before["score"], "after": after["score"],
            "better": after["score"] >= before["score"]}
