"""Optional model layer. Order of resolution: approved library note, then model, else nothing."""
from .llm_provider import LLMProvider, LLMUnavailable


def prompt_for(question: str, answer: str, dims: dict, fixes: list) -> str:
    scores = ", ".join(f"{k} {v}/10" for k, v in dims.items())
    return (
        "You are a blunt senior interview coach. In at most 60 words, give one specific, "
        "actionable improvement for this answer. No praise, no preamble.\n\n"
        f"Question: {question}\nAnswer: {answer}\nRule-based scores: {scores}\n"
        f"Rule-based fixes already given: {'; '.join(fixes)}\nYour improvement:"
    )


def coach_note(question: str, answer: str, dims: dict, fixes: list, store, provider: LLMProvider | None):
    """Returns {"text", "source"} or None. Library first (free), model second."""
    approved = store.find_approved(question)
    if approved:
        return {"text": approved, "source": "library"}
    if provider is None:
        return None
    try:
        return {"text": provider.complete(prompt_for(question, answer, dims, fixes)), "source": "model"}
    except LLMUnavailable:
        return None
