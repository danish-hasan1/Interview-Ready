"""Interview brief: a one-page, rules-built pre-interview summary from CV, role and practice."""
from .claims import extract_claims
from .interview import notes_plan
from .spaced import due_items
from .status_rules import SOLID_AT

ASK_THEM = [
    "What does success look like in the first 90 days, and how will it be measured?",
    "Which metric would you most like this function to move this year?",
    "What has held back hiring or people results so far?",
    "How does this role work with finance and the executive team on headcount planning?",
    "What would make you hesitate about a candidate for this role?",
    "What are the biggest trade-offs the team is making right now?",
]


def build_brief(cv_text: str, jd_text: str, gaps: list, claims: list, profile: dict) -> dict:
    refs = profile.get("refs", {})
    state = lambda ref: "untested" if ref not in refs else ("solid" if refs[ref]["last"] >= SOLID_AT else "shaky")  # noqa: E731
    metric = sorted([c for c in claims if c.type == "metric"], key=lambda c: -len(c.numbers))[:5]
    top = metric or claims[:5]
    open_gaps = [g for g in gaps if g.status != "evidenced"]
    covered = sum(1 for g in gaps if g.status == "evidenced")
    likely = [{"question": c.questions[0], "about": c.text, "state": state(c.text)} for c in top if c.questions]
    likely += [{"question": e["question"], "about": e["ref"], "state": "untested"} for e in notes_plan(jd_text)["extras"]]
    pitch_proof = top[0].text if top else "your strongest result"
    need = open_gaps[0].requirement if open_gaps else (gaps[0].requirement if gaps else "the role's top requirement")
    return {
        "role_fit": {"covered": covered, "total": len(gaps), "percent": round(covered / len(gaps) * 100) if gaps else None},
        "claims_to_defend": [{"text": c.text, "numbers": c.numbers, "state": state(c.text), "ownership": c.ownership} for c in top],
        "gaps": [{"requirement": g.requirement, "status": g.status} for g in open_gaps],
        "likely_questions": likely,
        "ask_them": ASK_THEM,
        "pitch": {"structure": ["Who you are (one line)", "Proof (your strongest number)", "Why this role (their need, your fit)"],
                  "draft": f"I lead talent and people delivery. Proof: {pitch_proof.rstrip('.')}. Why this role: you need {need.rstrip('.').lower()}, and that is where I add the most."},
        "focus": {"weakest": (profile.get("weaknesses") or [])[:2], "due_now": len(due_items(refs))},
    }
