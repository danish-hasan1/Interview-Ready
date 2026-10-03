"""Rules-first answer scoring. Each dimension 0-10, plus concrete fixes."""
import re
from dataclasses import dataclass, field

from .config import preset

DIMENSIONS = ["structure", "specificity", "length", "filler", "business_impact"]
_NUM = re.compile(r"\d")


@dataclass
class Score:
    dims: dict
    fixes: list
    total: float
    framework: str = ""
    notes: dict = field(default_factory=dict)
    relevance: dict = field(default_factory=dict)


def _words(text: str):
    return re.findall(r"[\w'&%$£€.-]+", text.lower())


def _count_phrases(text: str, phrases) -> int:
    low = f" {text.lower()} "
    return sum(len(re.findall(rf"(?<!\w){re.escape(p)}(?!\w)", low)) for p in phrases)


def _any(text: str, phrases) -> bool:
    return _count_phrases(text, phrases) > 0


def _parts(text: str, fw: dict) -> dict:
    return {name: _any(text, terms) for name, terms in fw["parts"].items()}


def _clauses(text: str) -> list:
    return [c for c in re.split(r"[.;:\n!?]+", text) if c.strip()]


def _spread_ok(text: str, fw: dict) -> bool:
    """Framework terms must sit in different clauses, not be listed in one breath."""
    clauses = [c.lower() for c in _clauses(text)]
    hit = set()
    for terms in fw["parts"].values():
        for i, c in enumerate(clauses):
            if any(re.search(rf"(?<!\w){re.escape(t)}", c) for t in terms):
                hit.add(i)
    return len(words_of(text)) >= 28 and len(hit) >= fw["min_parts"] - 1


def words_of(text: str) -> list:
    return re.findall(r"[\w'&%$£€.-]+", text.lower())


_Q_STOP = {"tell", "about", "what", "how", "did", "you", "your", "when", "would", "could", "please", "walk", "through", "say", "describe",
           "give", "example", "time", "does", "that", "mean", "exactly", "specific", "part", "versus", "team", "were", "was", "who", "which",
           "from", "with", "this", "have", "has", "the", "and", "for", "are", "can", "more", "made", "make", "business", "terms", "revenue",
           "cost", "margin", "impact", "measured", "baseline", "before", "started", "decided", "personally", "doing", "done", "across"}


def _stem(w: str) -> str:
    w = w.lower().strip(".,;:!?\"'()")
    return re.sub(r"(ing|ed|es|s|ion|ions|ly)$", "", w) if len(w) > 5 else w


def _stems(text: str, stop: set) -> set:
    return {_stem(w) for w in re.findall(r"[A-Za-z][A-Za-z&/+-]{2,}", text) if w.lower() not in stop and _stem(w) not in stop}


def relevance(answer: str, ref: str = "", kind: str = "") -> dict:
    """Does the answer touch the CV claim it is testing? Strict only for claim questions: gap, core and follow-up
    questions can be answered with different words, so they are never marked off-topic by rules."""
    if kind != "claim" or not ref:
        return {"level": "on", "overlap": None, "missing": []}
    s = preset("scoring")
    stop = set(s["stopwords"]) | _Q_STOP
    anchors = _stems(ref, stop)
    nums = {n.strip(".,").replace(",", "") for n in re.findall(r"\d[\d,.]*", ref)}
    if len(anchors) < 3:
        return {"level": "on", "overlap": None, "missing": []}
    ans_stems = _stems(answer, set())
    ans_nums = {n.strip(".,").replace(",", "") for n in re.findall(r"\d[\d,.]*", answer)}
    overlap = len(anchors & ans_stems) / len(anchors)
    num_hit = bool(nums & ans_nums)
    if overlap >= 0.25 or (num_hit and overlap >= 0.1):
        level = "on"
    elif overlap >= 0.1 or num_hit:
        level = "partial"
    else:
        level = "off"
    missing = sorted(anchors - ans_stems)[:4]
    return {"level": level, "overlap": round(overlap, 2), "missing": missing}


def expected_framework(question: str) -> str:
    """Which answer framework the question calls for: business | advisory | ''."""
    q = (question or "").lower()
    fws = preset("scoring")["frameworks"]
    for key in ("business", "advisory"):
        if any(c in q for c in fws[key]["question_cues"]):
            return key
    return ""


def score_structure(answer: str, s: dict):
    st = s["structure"]
    first = re.split(r"(?<=[.!?])\s+", answer.strip())[0] if answer.strip() else ""
    headline = 0 < len(first.split()) <= st["headline_max_words"]
    points = _any(answer, st["points"])
    example = _any(answer, st["example"])
    result = _any(answer, st["result"])
    context = _any(answer, st["context"])
    action = _any(answer, st["action"])
    parts = {"headline": headline, "points": points, "example": example, "result": result,
             "context": context, "action": action}
    if headline and points and example and result:
        fw = "Headline → 3 points → Example → Result"
    elif context and action and result:
        fw = "Context → Problem → Action → Result"
    else:
        fw = ""
    # best of the two frameworks
    a = sum([headline, points, example, result])
    b = sum([context, action, result, example])
    fws = s["frameworks"]
    biz, adv = _parts(answer, fws["business"]), _parts(answer, fws["advisory"])
    if not _spread_ok(answer, fws["business"]):
        biz = {k: False for k in biz}
    if not _spread_ok(answer, fws["advisory"]):
        adv = {k: False for k in adv}
    nb, na = sum(biz.values()), sum(adv.values())
    impact = _any(answer, s["impact"])
    fracs = [a / 4, b / 4, nb / 6, na / 5]
    if nb >= fws["business"]["min_parts"] and nb / 6 >= max(fracs[:2]):
        fw = fws["business"]["name"]
    elif na >= fws["advisory"]["min_parts"] and na / 5 >= max(fracs[:2]):
        fw = fws["advisory"]["name"]
    elif fw == "Context → Problem → Action → Result" and impact:
        fw = fws["cpar"]["name"]
    score = min(10, round(max(fracs) * 10))
    parts["business_parts"], parts["advisory_parts"] = biz, adv
    return score, fw, parts


def score_specificity(answer: str, s: dict):
    nums = len(_NUM.findall(answer))
    words = _words(answer)
    we = sum(words.count(w) for w in ["we", "our", "us"])
    i = sum(words.count(w) for w in ["i", "my", "me", "i'd", "i've", "i'm"])
    score = 0
    if nums:
        score += min(5, 2 + nums // 2)
    if i:
        score += 3 if i >= we else 1
    if _any(answer, s["structure"]["example"]):
        score += 2
    return min(10, score), {"numbers": nums, "i": i, "we": we}


def score_length(answer: str, s: dict):
    n = len(_words(answer))
    lo, hi = s["ideal_words"]
    if n == 0:
        return 0, n
    if n < lo:
        return max(2, round(10 * n / lo)), n
    if n <= hi:
        return 10, n
    over = n - hi
    return max(0, 10 - round(over / 15)), n


def score_filler(answer: str, s: dict):
    n = max(1, len(_words(answer)))
    found = {f: _count_phrases(answer, [f]) for f in s["fillers"]}
    found = {k: v for k, v in found.items() if v}
    rate = sum(found.values()) / n
    return max(0, 10 - round(rate * 100)), found


def score_impact(answer: str, s: dict):
    hits = _count_phrases(answer, s["impact"])
    if hits and _NUM.search(answer):
        return 10, hits
    return (6 if hits else 0), hits


def score_answer(answer: str, question: str = "", ref: str = "", kind: str = "") -> Score:
    s = preset("scoring")
    structure, fw, parts = score_structure(answer, s)
    specificity, spec_n = score_specificity(answer, s)
    length, wc = score_length(answer, s)
    filler, filler_found = score_filler(answer, s)
    impact, impact_hits = score_impact(answer, s)
    dims = {"structure": structure, "specificity": specificity, "length": length,
            "filler": filler, "business_impact": impact}

    fixes_by_dim = {
        "structure": "Open with a one-sentence headline, then give three points, one example, and end on the result.",
        "specificity": (
            "Add a number (how much, how many, by when)." if not spec_n["numbers"]
            else "Say 'I' for what you did - you used 'we' more than 'I'." if spec_n["we"] > spec_n["i"]
            else "Name one concrete example with your personal role in it."
        ),
        "length": (
            f"Cut it: {wc} words is too long. Land it in about 150 words (under a minute)." if wc > s["ideal_words"][1]
            else f"Too thin at {wc} words. Add your example and the result."
        ),
        "filler": "Drop filler words: " + ", ".join(f'"{k}" x{v}' for k, v in list(filler_found.items())[:4]) + ". Pause instead.",
        "business_impact": "State the business impact in revenue, cost or margin terms, with a number.",
    }
    want = expected_framework(question)
    if want and structure < 8:
        key = "business_parts" if want == "business" else "advisory_parts"
        have = parts[key]
        missing = [n for n, ok in have.items() if not ok]
        name = s["frameworks"][want]["name"]
        fixes_by_dim["structure"] = f"This question needs the {name} frame. You covered {len(have) - len(missing)} of {len(have)}; missing: {', '.join(missing)}."
    weakest = sorted(DIMENSIONS, key=lambda d: dims[d])
    fixes = [fixes_by_dim[d] for d in weakest if dims[d] < 7][:3]
    if want and structure < 8 and fixes_by_dim["structure"] not in fixes:
        fixes = fixes[:2] + [fixes_by_dim["structure"]]  # the question's expected frame always gets named
    if not fixes and answer.strip():
        fixes = ["Solid. Next: keep this structure under pressure and tighten the headline."]
    total = round(sum(dims.values()) / len(dims), 1)
    rel = relevance(answer, ref, kind)
    if rel["level"] == "off":
        total = min(total, 3.0)
        fixes = ["This does not answer the question. Anchor it to the claim being tested: " + ", ".join(rel["missing"] or ["your own line"]) + "."] + fixes[:2]
    elif rel["level"] == "partial":
        total = min(total, 6.5)
        fixes = ["Tie the answer to the claim itself. You did not mention: " + ", ".join(rel["missing"] or ["its key terms"]) + "."] + fixes[:2]
    if wc < 25 and answer.strip():
        total = min(total, 5.0)  # too thin to be a real answer, whatever the keywords
    return Score(dims, fixes, total, fw, {"words": wc, "fillers": filler_found, "structure_parts": parts}, rel)


def follow_up_for(answer: str, score: Score):
    """Pick a pressure phrase key from rules, or None if the answer is fine."""
    d, n = score.dims, score.notes
    words = n["words"]
    if words == 0:
        return "vague"
    if words > preset("scoring")["max_words"]:
        return "too_long"
    if d["structure"] < 5:
        return "unstructured"
    spec_n = score_specificity(answer, preset("scoring"))[1]
    if spec_n["numbers"] == 0:
        return "no_numbers"
    if spec_n["we"] > spec_n["i"]:
        return "no_ownership"
    if d["business_impact"] < 4:
        return "no_impact"
    if d["specificity"] < 5:
        return "vague"
    return None
