"""Remove contact details before any text leaves the machine. Deterministic, regex only."""
import re

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_URL = re.compile(r"(?:https?://|www\.)\S+|(?:linkedin|github|twitter|x)\.com/\S+", re.IGNORECASE)
_PHONE = re.compile(r"(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}(?!\w)")
_UK_POST = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b")
_STREET = re.compile(r"\b\d{1,5}\s+(?:[A-Z][\w'-]+\s+){1,3}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Court|Ct)\b\.?")
_TITLE_WORDS = {"manager", "head", "director", "lead", "specialist", "engineer", "analyst", "consultant", "partner", "vp", "officer", "recruiter",
                "executive", "coordinator", "associate", "senior", "chief", "talent", "acquisition", "summary", "profile", "experience", "curriculum", "vitae", "resume", "cv"}


def _looks_like_phone(m: str) -> bool:
    digits = re.sub(r"\D", "", m)
    # protect figures like 62, 38, $1.2M, 120000, dates: require a phone-like digit count with a separator or plus
    return 9 <= len(digits) <= 15 and bool(re.search(r"[\s().+-]", m.strip()))


def redact_cv(text: str) -> dict:
    removed = {"emails": 0, "links": 0, "phones": 0, "addresses": 0, "name": 0}

    def sub(rx, key, tag, s, check=None):
        def f(m):
            if check and not check(m.group(0)):
                return m.group(0)
            removed[key] += 1
            return tag
        return rx.sub(f, s)

    out = text
    out = sub(_EMAIL, "emails", "[EMAIL]", out)
    out = sub(_URL, "links", "[LINK]", out)
    out = sub(_STREET, "addresses", "[ADDRESS]", out)
    out = sub(_UK_POST, "addresses", "[POSTCODE]", out)
    out = sub(_PHONE, "phones", "[PHONE]", out, _looks_like_phone)

    lines = out.splitlines()
    for i, line in enumerate(lines):
        s = line.strip()
        if not s:
            continue
        words = re.findall(r"[A-Za-z][A-Za-z'.-]*", s)
        if 2 <= len(words) <= 4 and len(words) == len(s.split()) and all(w[0].isupper() for w in words) \
                and not any(w.lower().strip(".") in _TITLE_WORDS for w in words):
            lines[i] = "[NAME]"
            removed["name"] = 1
        break  # only the first non-empty line can be the name header
    return {"text": "\n".join(lines), "removed": removed, "total": sum(removed.values())}
