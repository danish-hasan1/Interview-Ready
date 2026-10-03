"""Rule-based CV claim inventory and hard follow-up questions."""
import re
from dataclasses import dataclass, field

from .config import preset
from .redact import is_contact_line

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
        if len(line) >= 12 and not is_contact_line(line):
            yield line


_SEP = re.compile(r"\s*[·|•❘❙│‖¦]\s*|\s{3,}")
_NUM_LED = re.compile(r"^(?:[$£€]|EUR|USD|GBP|INR|AED)?\s?\d")


def _line_claims(line: str):
    """Skill and keyword lists are not claims. Number-led headline segments ('EUR 5M+ P&L Owned') are."""
    segs = [s.strip() for s in _SEP.split(line) if s.strip()]
    if len(segs) >= 3:
        return [s for s in segs if _NUM_LED.match(s) and len(s.split()) >= 2]
    return _sentences(line)


def _tokens(s: str) -> set:
    stop = set(preset("scoring")["stopwords"]) | {"a", "an", "of", "in", "to", "by", "as", "on", "at", "into", "through", "across"}
    return {re.sub(r"(ing|ed|es|s)$", "", w) for w in re.findall(r"[a-z0-9$€£%+.]+", s.lower()) if w not in stop and len(w) > 1}


def _similar(a: Claim, b: Claim) -> bool:
    ta, tb = _tokens(a.text), _tokens(b.text)
    if not ta or not tb:
        return False
    inter = len(ta & tb)
    jac = inter / len(ta | tb)
    shared_num = bool(set(a.numbers) & set(b.numbers))
    return jac >= 0.45 or (shared_num and inter / min(len(ta), len(tb)) >= 0.5)


def _importance(c: Claim) -> float:
    s = preset("scoring")
    low = c.text.lower()
    return len(c.numbers) * 2 + sum(1 for t in s["impact"] if t in low) + (1 if low.split()[0] in s["action_verbs"] else 0)


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
        if line.isupper() and len(line.split()) <= 8:
            continue  # section heading such as EXECUTIVE SUMMARY
        for sent in _line_claims(line):
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
    kept: list = []
    for c in claims:  # CVs repeat the same achievement in the summary and again under each role
        dup = next((i for i, k in enumerate(kept) if k.type == c.type != "title" and _similar(c, k)), None)  # distinct titles stay distinct
        if dup is None:
            kept.append(c)
        elif (len(c.numbers), len(c.text)) > (len(kept[dup].numbers), len(kept[dup].text)):
            kept[dup] = c
    order = {"metric": 0, "action": 1, "title": 2}
    kept.sort(key=lambda c: (order[c.type], -_importance(c)))
    return kept
