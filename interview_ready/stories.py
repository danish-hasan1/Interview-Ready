"""Story bank: reusable CPAR+impact stories, scored and matched to questions."""
import re

from .config import preset
from .scoring import score_answer

_NUM = re.compile(r"\d")


def themes() -> dict:
    return preset("story_themes")


def compose(fields: dict) -> str:
    parts = []
    for f in themes()["fields"]:
        v = (fields.get(f["key"]) or "").strip().rstrip(".")
        if v:
            parts.append(f["joiner"] + v)
    return ". ".join(parts) + ("." if parts else "")


def check_story(theme_id: str, fields: dict) -> dict:
    th = next((t for t in themes()["themes"] if t["id"] == theme_id), None)
    if not th:
        raise KeyError(theme_id)
    notes = []
    ok = True
    for f in themes()["fields"]:
        v = (fields.get(f["key"]) or "").strip()
        msg = None
        if not v:
            msg = "Empty. Fill this in."
        elif f.get("needs_number") and not _NUM.search(v):
            msg = "Add a number."
        elif f.get("needs_i"):
            words = re.findall(r"[a-z']+", v.lower())
            i, we = sum(words.count(w) for w in ("i", "my", "me")), sum(words.count(w) for w in ("we", "our", "us"))
            if i == 0 or we > i:
                msg = "Say what YOU did. Use 'I' for your decisions."
        notes.append({"key": f["key"], "ok": msg is None, "msg": msg or "Good."})
        ok = ok and msg is None
    composed = compose(fields)
    s = score_answer(composed, th["prompt"])
    return {"fields": notes, "composed": composed, "score": s.total, "dims": s.dims, "fixes": s.fixes, "framework": s.framework,
            "ready": ok and s.total >= 6}


def theme_for(question: str) -> str:
    q = (question or "").lower()
    best, hits = "", 0
    for t in themes()["themes"]:
        n = sum(1 for c in t["cues"] if c in q)
        if n > hits:
            best, hits = t["id"], n
    return best


def coverage(stories: list) -> dict:
    core = [t["id"] for t in themes()["themes"] if t["core"]]
    have = {s["theme"] for s in stories if s["score"] >= 6}
    return {"core_total": len(core), "core_ready": sum(1 for c in core if c in have), "missing_core": [c for c in core if c not in have]}
