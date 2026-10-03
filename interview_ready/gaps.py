"""Compare CV vs JD: list missing or weakly evidenced requirements."""
import re
from dataclasses import dataclass, field

from .config import preset

_REQ_HINT = re.compile(
    r"\b(require|required|must|experience|ability|proven|responsible|manage|lead|own|build|develop|knowledge|skilled|expertise|familiar)\w*",
    re.IGNORECASE,
)
_BULLET = re.compile(r"^\s*(?:[-•*▪●◦‣–]|\d+[.)])\s*")
_HAS_NUM = re.compile(r"\d")


@dataclass
class Gap:
    requirement: str
    status: str  # missing | weak | evidenced
    coverage: float
    keywords: list = field(default_factory=list)
    evidence: list = field(default_factory=list)


def _keywords(text: str):
    stop = set(preset("scoring")["stopwords"])
    words = re.findall(r"[a-zA-Z][a-zA-Z&+/-]{2,}", text.lower())
    return sorted({w for w in words if w not in stop})


def _stem(w: str) -> str:
    return re.sub(r"(ing|ed|es|s|ion|ions)$", "", w) if len(w) > 5 else w


def extract_requirements(jd_text: str) -> list:
    reqs = []
    for raw in jd_text.splitlines():
        line = _BULLET.sub("", raw).strip()
        if len(line) < 15:
            continue
        bulleted = bool(_BULLET.match(raw))
        if bulleted or _REQ_HINT.search(line):
            reqs.append(line.rstrip("."))
    seen, out = set(), []
    for r in reqs:
        if r.lower() not in seen:
            seen.add(r.lower())
            out.append(r)
    return out


def analyse_gaps(cv_text: str, jd_text: str) -> list:
    cv_lines = [_BULLET.sub("", l).strip() for l in cv_text.splitlines() if l.strip()]
    cv_stems = {_stem(w) for w in _keywords(cv_text)}
    gaps = []
    for req in extract_requirements(jd_text):
        kws = _keywords(req)
        if not kws:
            continue
        hit = [k for k in kws if _stem(k) in cv_stems]
        coverage = len(hit) / len(kws)
        evidence = [
            l for l in cv_lines
            if sum(1 for k in hit if _stem(k) in {_stem(w) for w in _keywords(l)}) >= max(1, len(hit) // 2)
        ][:3] if hit else []
        quantified = any(_HAS_NUM.search(l) for l in evidence)
        if coverage < 0.25:
            status = "missing"
        elif coverage < 0.6 or not quantified:
            status = "weak"
        else:
            status = "evidenced"
        gaps.append(Gap(req, status, round(coverage, 2), kws, evidence))
    order = {"missing": 0, "weak": 1, "evidenced": 2}
    gaps.sort(key=lambda g: (order[g.status], g.coverage))
    return gaps


def gap_questions(gaps: list, limit: int = 4) -> list:
    templates = preset("hard_questions")["gap"]
    out = []
    for i, g in enumerate(g for g in gaps if g.status != "evidenced"):
        if i >= limit:
            break
        out.append(templates[i % len(templates)].format(req=g.requirement[:110]))
    return out


def gap_items(gaps: list, limit: int = 4) -> list:
    """Gap questions tied to the requirement they test: [{"question", "ref"}]."""
    templates = preset("hard_questions")["gap"]
    out = []
    for i, g in enumerate(g for g in gaps if g.status != "evidenced"):
        if i >= limit:
            break
        out.append({"question": templates[i % len(templates)].format(req=g.requirement[:110]), "ref": g.requirement})
    return out
