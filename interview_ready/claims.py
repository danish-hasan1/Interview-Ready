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
    keywords: list = field(default_factory=list)


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


def extract_keywords(sent: str) -> list:
    """Proper nouns, acronyms and commercial terms worth being asked about."""
    s = preset("scoring")
    words = re.findall(r"[A-Za-z][A-Za-z&/+-]*", sent)
    out = []
    for i, w in enumerate(words):
        if (len(w) >= 2 and w.isupper()) or (i > 0 and w[0].isupper() and len(w) > 2):
            out.append(w)
    low = sent.lower()
    out += [t for t in s["impact"] if re.search(rf"(?<!\w){re.escape(t)}(?!\w)", low)]
    seen, res = set(), []
    for k in out:
        if k.lower() not in seen:
            seen.add(k.lower()); res.append(k)
    return res[:6]


_DATE_TAIL = re.compile(r"\s*(?:\(?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}|(?:19|20)\d{2})\s*[–—-]\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:(?:19|20)\d{2}|present|current)\)?\s*$", re.IGNORECASE)


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
            if ctype == "title":
                sent = _DATE_TAIL.sub("", sent).strip(" -–—,")  # show the title, not the date range
                key = sent.lower()
                if key in seen or len(sent) < 6:
                    continue
            seen.add(key)
            c = Claim(text=sent, type=ctype, numbers=numbers, keywords=extract_keywords(sent))
            c.questions = build_questions(c)
            claims.append(c)
    order = {"metric": 0, "action": 1, "title": 2}
    claims.sort(key=lambda c: order[c.type])
    return claims
