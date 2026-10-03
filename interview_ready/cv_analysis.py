"""Rule-based CV review: scores the CV itself, flags weak lines, points to lessons."""
import re
from dataclasses import asdict, dataclass, field

from .config import preset

_BULLET = re.compile(r"^\s*(?:[-•*▪●◦‣–]|\d+[.)])\s*")
_NUM = re.compile(r"(?:[$£€]\s?\d[\d,.]*\s?(?:k|m|bn)?)|(?:\d[\d,.]*\s?(?:%|k\b|m\b|bn\b|x\b))|\b\d+\b", re.IGNORECASE)
_YEAR = re.compile(r"^(19|20)\d{2}$")


@dataclass
class BulletReview:
    text: str
    score: int
    issues: list = field(default_factory=list)


def _words(text: str) -> list:
    return re.findall(r"[\w'&%$£€.,-]+", text)


def _has_number(text: str) -> bool:
    return any(not _YEAR.match(m.group(0).strip()) for m in _NUM.finditer(text))


def _verbs() -> set:
    return set(preset("scoring")["action_verbs"]) | set(preset("cv_rules")["extra_action_verbs"])


_DATE = re.compile(r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}|(?:19|20)\d{2}\s*[–—-]\s*(?:(?:19|20)\d{2}|present|current)|\b(?:present|current)\b", re.IGNORECASE)
_TITLE_WORDS = {"manager", "head", "director", "lead", "specialist", "engineer", "analyst", "consultant", "partner", "vp", "officer", "recruiter",
                "executive", "coordinator", "associate", "senior", "chief", "intern", "assistant", "president"}


def _is_header(line: str, bulleted: bool) -> bool:
    """Job titles, company names, dates and section headings are not achievements."""
    words = _words(line)
    n = len(words)
    first = words[0].lower().strip(",:") if words else ""
    if line.isupper() and n <= 6:
        return True
    if _DATE.search(line) and n <= 14 and not re.search(r"\b(led|built|cut|reduced|increased|delivered|managed)\b", line, re.IGNORECASE):
        return True  # "Head of Talent Acquisition May 2026 - Present"
    if first in _verbs():
        return False
    if any(w.lower().strip(".,:-–") in _TITLE_WORDS for w in words) and n <= 10 and not bulleted:
        return True
    if not bulleted and n <= 9 and not _has_number(line) and not line.rstrip().endswith("."):
        return True  # company, location, degree lines
    return False


def candidate_bullets(cv_text: str) -> list:
    """Lines that read like achievements. Titles, companies, dates and headings are excluded."""
    out = []
    for raw in cv_text.splitlines():
        bulleted = bool(_BULLET.match(raw))
        line = _BULLET.sub("", raw).strip()
        words = _words(line)
        if len(words) < 6 or _is_header(line, bulleted):
            continue
        out.append(line)
    return out


def review_bullet(text: str) -> BulletReview:
    rules, s = preset("cv_rules"), preset("scoring")
    low = text.lower()
    words = _words(text)
    first = (words[0].lower().strip(",:") if words else "")
    issues, score = [], 0

    if _has_number(text):
        score += 35
    else:
        issues.append("No number. Add scale, budget, volume or a before-and-after figure.")
    if first in _verbs():
        score += 20
    else:
        issues.append("Does not open with a strong action verb (led, built, cut, negotiated).")
    weak = [p for p in rules["weak_phrases"] if re.search(rf"\b{re.escape(p)}\b", low)]
    if weak:
        issues.append(f"Weak phrasing: “{weak[0]}”. Say what you did, not what you were near.")
    else:
        score += 10
    if any(w in low for w in rules["result_words"]) and _has_number(text):
        score += 20
    else:
        issues.append("No visible result. State the outcome: from what, to what.")
    n = len(words)
    if rules["min_bullet_words"] <= n <= rules["max_bullet_words"]:
        score += 10
    elif n > rules["max_bullet_words"]:
        issues.append(f"{n} words is too long for a CV line. Aim for under {rules['max_bullet_words']}.")
    else:
        issues.append("Too thin. Add scope and result.")
    if any(re.search(rf"(?<!\w){re.escape(t)}(?!\w)", low) for t in s["impact"]):
        score += 5
    return BulletReview(text, min(100, score), issues)


def analyse_cv(cv_text: str) -> dict:
    rules, s = preset("cv_rules"), preset("scoring")
    bullets = candidate_bullets(cv_text)
    reviews = [review_bullet(b) for b in bullets]
    n = max(1, len(bullets))
    low_all = cv_text.lower()

    verbs = _verbs()
    quantified = sum(1 for b in bullets if _has_number(b))
    strong = sum(1 for b in bullets if _words(b) and _words(b)[0].lower().strip(",:") in verbs)
    weak = sum(1 for b in bullets if any(re.search(rf"\b{re.escape(p)}\b", b.lower()) for p in rules["weak_phrases"]))
    results = sum(1 for b in bullets if _has_number(b) and any(w in b.lower() for w in rules["result_words"]))
    long_ = sum(1 for b in bullets if len(_words(b)) > rules["max_bullet_words"])
    impact_terms = sorted({t for t in s["impact"] if re.search(rf"(?<!\w){re.escape(t)}(?!\w)", low_all)})
    sections = {k: any(v in low_all for v in vs) for k, vs in rules["sections"].items()}
    total_words = len(_words(cv_text))

    cats = {
        "impact": min(100, round(quantified / n / 0.6 * 100)),
        "ownership": round(max(0, (strong / n) * 0.7 + (1 - weak / n) * 0.3) * 100),
        "outcomes": min(100, round(results / n / 0.5 * 100)),
        "business": min(100, len(impact_terms) * 25),
        "concision": max(0, 100 - round(long_ / n * 200) - (20 if total_words > 1000 else 0) - (20 if total_words < 250 else 0)),
        "structure": round(sum(sections.values()) / len(sections) * 100),
    }
    overall = round(sum(cats[k] * w for k, w in rules["weights"].items()))

    def ev(pred, k=3):
        return [b for b in bullets if pred(b)][:k]

    findings = []
    if quantified / n < 0.5:
        findings.append({"severity": "high", "title": f"Only {quantified} of {len(bullets)} lines carry a number",
            "detail": "Numbers are what interviewers pull on. Lines without them read as activity, not impact.",
            "fix": "Add scale, budget, volume or a before-and-after figure to every line you want to be asked about.",
            "evidence": ev(lambda b: not _has_number(b)), "lesson": "cv_bullets"})
    if weak:
        findings.append({"severity": "high" if weak / n > 0.2 else "med", "title": f"{weak} line{'s' if weak > 1 else ''} use weak phrasing",
            "detail": "“Responsible for”, “helped” and “involved in” hide what you personally did.",
            "fix": "Open with a verb for your decision or result: led, built, cut, negotiated, redesigned.",
            "evidence": ev(lambda b: any(re.search(rf"\b{re.escape(p)}\b", b.lower()) for p in rules["weak_phrases"])), "lesson": "own_it"})
    if strong / n < 0.6:
        findings.append({"severity": "med", "title": "Many lines do not open with an action verb",
            "detail": "Strong openers signal ownership and make lines scannable in seconds.",
            "fix": "Start each line with the action you took.",
            "evidence": ev(lambda b: not (_words(b) and _words(b)[0].lower().strip(",:") in verbs)), "lesson": "own_it"})
    if cats["business"] < 50:
        findings.append({"severity": "high", "title": "Little commercial language",
            "detail": "Senior roles are hired for business impact. Your CV rarely mentions revenue, cost, margin or budget.",
            "fix": "Tie your results to money or capacity: cost saved, revenue protected, headcount, budget owned.",
            "evidence": [], "lesson": "pl_fluency"})
    if cats["outcomes"] < 50:
        findings.append({"severity": "med", "title": "Results are not stated",
            "detail": "Many lines say what you did but not what changed.",
            "fix": "Use “from A to B” or “by X% across Y”.", "evidence": ev(lambda b: not any(w in b.lower() for w in rules["result_words"])), "lesson": "defend_number"})
    if long_:
        findings.append({"severity": "low", "title": f"{long_} line{'s' if long_ > 1 else ''} run long",
            "detail": "Long lines bury the number.", "fix": f"Cut to under {rules['max_bullet_words']} words; keep the story for the interview.",
            "evidence": ev(lambda b: len(_words(b)) > rules["max_bullet_words"]), "lesson": "concise"})
    missing = [k for k, v in sections.items() if not v]
    if missing:
        findings.append({"severity": "low", "title": f"Missing section: {', '.join(missing)}",
            "detail": "Recruiters and ATS scan for standard sections.", "fix": "Add clear headings for each.", "evidence": [], "lesson": None})
    findings.sort(key=lambda f: {"high": 0, "med": 1, "low": 2}[f["severity"]])

    strengths = []
    if quantified / n >= 0.5:
        strengths.append(f"{round(quantified / n * 100)}% of lines carry a number.")
    if strong / n >= 0.6:
        strengths.append("Most lines open with an action verb.")
    if cats["business"] >= 50:
        strengths.append("Uses commercial language: " + ", ".join(impact_terms[:4]) + ".")
    if not weak:
        strengths.append("No weak phrasing found.")
    if all(sections.values()):
        strengths.append("All standard sections present.")

    worst = sorted(reviews, key=lambda r: r.score)[:8]
    return {
        "score": overall,
        "band": "Strong" if overall >= 75 else "Solid base" if overall >= 55 else "Needs work",
        "categories": cats,
        "findings": findings,
        "strengths": strengths,
        "bullets_to_fix": [asdict(r) for r in worst if r.score < 80],
        "stats": {"lines": len(bullets), "quantified": quantified, "strong_verbs": strong, "weak_phrases": weak, "words": total_words,
                  "impact_terms": impact_terms, "sections": sections},
    }
