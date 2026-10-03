"""Rule-based CV claim inventory and hard follow-up questions."""
import re
from dataclasses import dataclass, field

from .config import preset

OWNERSHIP_LEVELS = ["Owned", "Led", "Contributed", "Supported", "Exposure"]

_NUM = re.compile(
    r"(?:[$£€]\s?\d[\d,.]*\s?(?:k|m|bn|b)?\b)|(?:\b\d[\d,.]*\s?(?:%|k\b|m\b|bn\b|x\b|\+))|(?:\b\d[\d,.]*\b)",
    re.IGNORECASE,
)
_BULLET = re.compile(r"^\s*(?:[-•*▪●◦‣–]|\d+[.)])\s*")


@dataclass
class Claim:
    text: str
    type: str  # metric | title | action
    numbers: list = field(default_factory=list)
    ownership: str = "Contributed"
    questions: list = field(default_factory=list)


def _lines(text: str):
    for raw in text.splitlines():
        line = _BULLET.sub("", raw).strip()
        if len(line) >= 12:
            yield line


def _sentences(line: str):
    parts = re.split(r"(?<=[.;])\s+(?=[A-Z])", line)
    return [p.strip() for p in parts if len(p.strip()) >= 12]


def build_questions(claim: Claim) -> list:
    p = preset("hard_questions")
    qs = [q.format(claim=_short(claim.text)) for q in p.get(claim.type, [])]
    qs += p["ownership"].get(claim.ownership, [])
    qs += p["always"]
    return qs


def _short(text: str, n: int = 110) -> str:
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def extract_claims(cv_text: str) -> list:
    s = preset("scoring")
    verbs = tuple(s["action_verbs"])
    titles = s["title_words"]
    claims, seen = [], set()
    for line in _lines(cv_text):
        for sent in _sentences(line):
            key = sent.lower()
            if key in seen:
                continue
            numbers = [m.group(0).strip() for m in _NUM.finditer(sent)]
            # drop bare years from "numbers"
            numbers = [n for n in numbers if not re.fullmatch(r"(19|20)\d{2}", n)]
            lowered = key
            first = lowered.split()[0].strip(",:") if lowered.split() else ""
            if numbers:
                ctype = "metric"
            elif first in verbs or any(f" {v} " in f" {lowered} " for v in verbs):
                ctype = "action"
            elif len(sent.split()) <= 12 and any(re.search(rf"\b{re.escape(t)}\b", lowered) for t in titles):
                ctype = "title"
            else:
                continue
            seen.add(key)
            c = Claim(text=sent, type=ctype, numbers=numbers)
            c.questions = build_questions(c)
            claims.append(c)
    order = {"metric": 0, "action": 1, "title": 2}
    claims.sort(key=lambda c: order[c.type])
    return claims
