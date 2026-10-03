"""Pre-interview training: a plan built from the CV review, role gaps and practice history."""
import re

from .config import preset
from .cv_analysis import review_bullet
from .scoring import score_answer

_NUM = re.compile(r"\d")
_WORDS = lambda t: re.findall(r"[\w'&%$£€.,-]+", t)  # noqa: E731

# practice dimension -> lesson to fix it
DIM_LESSON = {"structure": "structure", "specificity": "defend_number", "length": "concise", "filler": "concise", "business_impact": "pl_fluency"}


def lessons() -> list:
    return preset("lessons")["lessons"]


def lesson_map() -> dict:
    return {l["id"]: l for l in lessons()}


def build_plan(cv_review: dict, gaps: list, profile: dict) -> list:
    """Return [{lesson_id, reason, priority}] ordered, deduped, max 7."""
    lm = lesson_map()
    picks: dict = {}

    def add(lesson_id, reason, priority):
        if lesson_id not in lm:
            return
        cur = picks.get(lesson_id)
        if cur is None or priority < cur["priority"]:
            picks[lesson_id] = {"lesson_id": lesson_id, "reason": reason, "priority": priority}
        elif reason not in cur["reason"]:
            cur["reason"] += " " + reason

    for f in cv_review["findings"]:
        if f.get("lesson"):
            add(f["lesson"], f["title"] + ".", {"high": 1, "med": 2, "low": 4}[f["severity"]])

    missing = [g for g in gaps if g.status != "evidenced"]
    if len(missing) >= 2:
        add("strategic", f"{len(missing)} role requirements are missing or weak on your CV. Practise answering strategically.", 2)
    commercial = [g for g in missing if re.search(r"p&l|commercial|budget|margin|financ|revenue", g.requirement, re.IGNORECASE)]
    if commercial:
        add("pl_fluency", "The role asks for commercial skills your CV does not show: " + commercial[0].requirement[:70] + ".", 1)
        add("biz_vocab", "Business vocabulary supports the commercial case.", 3)

    for dim, avg in (profile.get("dims") or {}).items():
        if avg < 6 and dim in DIM_LESSON:
            add(DIM_LESSON[dim], f"Your practice average for {dim.replace('_', ' ')} is {avg}/10.", 1)

    add("structure", "Every answer needs a shape the interviewer can follow.", 3)
    add("pressure", "Practise recovering when the interviewer says “I'm not following”.", 5)
    add("defend_number", "Be ready to defend every number on your CV.", 4)

    plan = sorted(picks.values(), key=lambda p: (p["priority"], p["lesson_id"]))[:7]
    for p in plan:
        l = lm[p["lesson_id"]]
        p["title"], p["minutes"] = l["title"], l["minutes"]
    return plan


def check_rewrite(original: str, rewrite: str) -> dict:
    before, after = review_bullet(original), review_bullet(rewrite)
    return {"before": before.score, "after": after.score, "issues": after.issues, "improved": after.score > before.score,
            "good": after.score >= 80}


def check_build(lesson_id: str, values: dict) -> dict:
    l = lesson_map().get(lesson_id)
    if not l or l["drill"]["type"] != "build":
        raise KeyError(lesson_id)
    d = l["drill"]
    parts, notes = [], []
    ok = True
    for f in d["fields"]:
        v = (values.get(f["key"]) or "").strip()
        n = len(_WORDS(v))
        if not v:
            notes.append({"key": f["key"], "ok": False, "msg": "Empty. Fill this in."}); ok = False; continue
        msg = None
        if f.get("max_words") and n > f["max_words"]:
            msg = f"{n} words. Cut to {f['max_words']} or fewer."
        elif f.get("min_words") and n < f["min_words"]:
            msg = f"{n} words. Add detail (at least {f['min_words']})."
        elif f.get("needs_number") and not _NUM.search(v):
            msg = "Add a number."
        notes.append({"key": f["key"], "ok": msg is None, "msg": msg or "Good."})
        ok = ok and msg is None
        parts.append(d["joiners"].get(f["key"], "") + v)
    composed = ". ".join(p.rstrip(".") for p in parts) + "."
    score = score_answer(composed)
    return {"fields": notes, "composed": composed, "score": score.total, "dims": score.dims, "fixes": score.fixes,
            "framework": score.framework, "pass": ok and score.total >= 6}
