"""Core interview questions: rule checks per question, stage-aware sets, prepared answers."""
import re

from .config import preset
from .scoring import score_answer

_NUM = re.compile(r"\d")
_NEG = ["hate", "toxic", "terrible", "awful", "horrible", "incompetent", "stupid", "my boss is", "bad manager", "useless", "fired me", "sick of"]
_CLICHE = ["perfectionist", "workaholic", "work too hard", "care too much", "too passionate"]
_WORDS = lambda t: re.findall(r"[\w'&%$£€.-]+", t)  # noqa: E731


def bank() -> dict:
    return preset("core_questions")


def question(qid: str) -> dict | None:
    return next((q for q in bank()["questions"] if q["id"] == qid), None)


def stage_ids(stage: str) -> list:
    st = bank()["stages"].get(stage) or bank()["stages"]["general"]
    return st["core"]


def stage_persona(stage: str) -> str:
    return (bank()["stages"].get(stage) or bank()["stages"]["general"])["persona"]


def _has(text: str, terms) -> bool:
    low = text.lower()
    return any(t in low for t in terms)


def check_core(qid: str, text: str, company: str = "", role: str = "") -> dict:
    q = question(qid)
    if not q:
        raise KeyError(qid)
    text = text.strip()
    words = _WORDS(text)
    n = len(words)
    lo, hi = q["words"]
    checks = []  # (ok, weight, message)

    def add(ok, weight, msg):
        checks.append({"ok": bool(ok), "weight": weight, "msg": msg})

    add(lo <= n <= hi, 3, f"{n} words. Aim for {lo} to {hi}." if not lo <= n <= hi else f"{n} words: good length.")
    if qid == "tell_me":
        add(_has(text, ["currently", "today", "i lead", "i am", "i'm", "i head", "i run", "i manage"]), 2, "Open with the present: who you are and what you do now.")
        add(_has(text, ["previously", "before that", "earlier", "started", "began", "prior", "years ago", "spent"]), 2, "Add the past: one or two moves that built your strength.")
        add(_has(text, ["looking", "next", "excited", "this role", "want to", "keen", "move into", "bring"]), 2, "Close on the future: why this role is the next step.")
        add(bool(_NUM.search(text)), 2, "Add at least one number as proof.")
    elif qid == "why_company":
        add(bool(company) and company.lower() in text.lower() if company else True, 3, f"Name {company or 'the company'} in your answer.")
        add(bool(_NUM.search(text)) or bool(re.search(r"\b[A-Z][a-z]{2,}\b.*\b[A-Z][a-z]{2,}\b", text[len(company):] if company else text)), 2, "Be specific: a product, market, number or recent move, not generalities.")
        add(_has(text, ["because", "so ", "which means", "that is why", "since"]), 1, "Give a reason, not just praise.")
        add(_has(text, ["i can", "i would", "i will", "contribute", "bring", "i've", "i have", "my experience"]), 2, "End on what you would contribute.")
    elif qid == "why_role":
        add(bool(_NUM.search(text)), 2, "Show you have solved a version of it, with a number.")
        add(_has(text, ["challenge", "scope", "opportunity", "next step", "responsib", "lead", "build", "scale"]), 1, "Name what draws you to this level of scope.")
    elif qid == "why_leaving":
        add(not _has(text, _NEG), 3, "Remove criticism of your employer or manager. Move towards, not away.")
        add(_has(text, ["looking for", "want to", "next", "opportunity", "growth", "scope", "challenge", "ready to", "keen"]), 2, "Say what you are moving towards.")
    elif qid == "strengths":
        add(bool(_NUM.search(text)), 3, "Back each strength with evidence that has a number.")
        add(len(re.findall(r"\b(first|second|third|one|two|three|another)\b", text.lower())) >= 2 or text.count(",") >= 2, 1, "Name two or three strengths, clearly separated.")
    elif qid == "weakness":
        add(not _has(text, _CLICHE), 3, "Avoid clichés (perfectionist, workaholic). Pick a real, non-fatal weakness.")
        add(_has(text, ["working on", "improved", "learned", "now i", "to address", "i started", "i've since", "i have since", "put in place", "changed"]), 3, "Show what you did about it and the result.")
    elif qid == "achievement":
        add(bool(_NUM.search(text)), 3, "Give the result as a number.")
        add(_has(text, ["i led", "i built", "i decided", "i designed", "i negotiated", "i created", "i launched", "i cut", "i introduced", "my role", "i "]), 2, "Say what YOU did, not the team.")
        add(_has(text, ["revenue", "cost", "margin", "saving", "growth", "retention", "time to", "budget", "profit", "efficiency"]), 2, "Close on business impact.")
    elif qid == "why_hire":
        add(bool(_NUM.search(text)), 3, "Give at least one proof point with a number.")
        add(_has(text, ["you need", "the role needs", "your need", "you are looking", "this role", "your priority", "your challenge"]), 2, "Tie your proof to what the role needs.")
    elif qid == "five_years":
        add(not _has(text, ["your job", "your position", "stepping stone", "this job as"]), 3, "Never imply this job is a stepping stone.")
        add(_has(text, ["scope", "impact", "grow", "lead", "build", "own", "business", "team"]), 1, "Describe the scope and impact you want, not a title.")
    elif qid == "salary":
        add(bool(_NUM.search(text)), 4, "Give a number.")
        add(bool(re.search(r"\d[\d,.k]*\s*(?:-|to|and|–)\s*\$?£?€?\d", text.lower())), 3, "Give a range, not a single figure.")
        add(_has(text, ["package", "open to", "flexible", "total", "discuss", "bonus"]), 1, "Say you are open to discussing the full package.")
        add(not _has(text, ["whatever", "anything", "not sure", "don't mind"]), 2, "Do not say 'whatever' or 'not sure'. Anchor to scope and results.")
    elif qid == "availability":
        add(bool(_NUM.search(text)) or _has(text, ["immediately", "now"]), 3, "State your notice period as a number, or say immediately.")
    elif qid == "questions_for_us":
        qs = text.count("?") or len([l for l in text.splitlines() if l.strip()])
        add(qs >= q.get("min_questions", 3), 4, f"Write at least {q.get('min_questions', 3)} real questions. You have {qs}.")
        add(not re.fullmatch(r"(?is)\W*(what|how)\W+(is|are)\W+(the\W+)?(salary|pay|holiday|leave|vacation)\W*\??", text), 1, "Do not only ask about pay or leave.")

    rules = sum(c["weight"] for c in checks if c["ok"]) / max(1, sum(c["weight"] for c in checks)) * 10
    base = score_answer(text, q["question"]).total if text else 0
    final = round(0.7 * rules + 0.3 * base, 1) if text else 0
    hard = all(c["ok"] for c in checks if c["weight"] >= 3)
    return {"score": final, "checks": checks, "ready": bool(text) and hard and final >= 6, "words": n,
            "fixes": [c["msg"] for c in checks if not c["ok"]][:3]}
