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


def _words(text: str):
    return re.findall(r"[\w'&%$£€.-]+", text.lower())


def _count_phrases(text: str, phrases) -> int:
    low = f" {text.lower()} "
    return sum(len(re.findall(rf"(?<!\w){re.escape(p)}(?!\w)", low)) for p in phrases)


def _any(text: str, phrases) -> bool:
    return _count_phrases(text, phrases) > 0


def _parts(text: str, fw: dict) -> dict:
    return {name: _any(text, terms) for name, terms in fw["parts"].items()}


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


def score_answer(answer: str, question: str = "") -> Score:
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
    return Score(dims, fixes, total, fw, {"words": wc, "fillers": filler_found, "structure_parts": parts})


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
