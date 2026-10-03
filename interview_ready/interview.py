"""Mock interview engine: question queue from CV claims + JD gaps, pressure follow-ups."""
from dataclasses import dataclass, field

from .claims import Claim
from .config import preset
from .scoring import follow_up_for, score_answer


@dataclass
class Turn:
    question: str
    kind: str  # claim | gap | followup
    ref: str = ""  # CV claim text or JD requirement this question tests


@dataclass
class Interview:
    queue: list
    max_questions: int = 6
    max_followups_per_question: int = 1
    asked: int = 0
    followups_used: int = 0
    current: Turn = None
    done: bool = False
    history: list = field(default_factory=list)

    def start(self):
        return self._next_main()

    def _next_main(self):
        if self.asked >= min(self.max_questions, len(self.queue)):
            self.done, self.current = True, None
            return None
        self.current = self.queue[self.asked]
        self.asked += 1
        self.followups_used = 0
        return self.current

    def answer(self, text: str):
        """Score answer, return (score, next_turn). next_turn None when finished."""
        score = score_answer(text)
        self.history.append((self.current, text, score))
        key = None
        if self.current.kind != "followup" and self.followups_used < self.max_followups_per_question:
            key = follow_up_for(text, score)
        if key:
            self.followups_used += 1
            self.current = Turn(preset("pressure")[key], "followup", self.current.ref)
            return score, self.current
        return score, self._next_main()


def build_queue(claims: list, gap_items: list, max_questions: int = 6, focus: str = "") -> list:
    """Interleave claim questions (one per claim, rotating) with gap questions.
    gap_items: [{"question", "ref"}]. focus: drill one claim/requirement with all its questions."""
    if focus:
        for c in claims:
            if c.text == focus:
                return [Turn(q, "claim", c.text) for q in c.questions[:max_questions]]
        qs = [g for g in gap_items if g["ref"] == focus]
        return [Turn(g["question"], "gap", g["ref"]) for g in qs]
    claim_turns = [Turn(c.questions[0], "claim", c.text) for c in claims if c.questions]
    gap_turns = [Turn(g["question"], "gap", g["ref"]) for g in gap_items]
    queue, ci, gi = [], 0, 0
    while len(queue) < max_questions and (ci < len(claim_turns) or gi < len(gap_turns)):
        if ci < len(claim_turns):
            queue.append(claim_turns[ci]); ci += 1
        if ci < len(claim_turns) and len(queue) < max_questions:
            queue.append(claim_turns[ci]); ci += 1
        if gi < len(gap_turns) and len(queue) < max_questions:
            queue.append(gap_turns[gi]); gi += 1
    return queue


def step(state: dict, answer: str, max_questions: int = 10, max_followups: int = 1):
    """Stateless version for the API. state = {queue, asked, followups_used, current}.
    Returns (score, new_state); new_state['current'] is None when finished."""
    queue = [Turn(**t) for t in state["queue"]]
    cur = Turn(**state["current"])
    asked, used = state["asked"], state["followups_used"]
    max_followups = state.get("max_followups", max_followups)
    score = score_answer(answer, cur.question, cur.ref, cur.kind)
    key = follow_up_for(answer, score) if cur.kind != "followup" and used < max_followups else None
    if key:
        phrases = {**preset("pressure"), **state.get("phrases", {})}
        nxt, used = Turn(phrases[key], "followup", cur.ref), used + 1
    elif asked >= min(max_questions, len(queue)):
        nxt = None
    else:
        nxt, asked, used = queue[asked], asked + 1, 0
    return score, {
        "queue": state["queue"], "asked": asked, "followups_used": used, "max_followups": max_followups,
        "phrases": state.get("phrases", {}), "persona": state.get("persona", "standard"),
        "current": None if nxt is None else {"question": nxt.question, "kind": nxt.kind, "ref": nxt.ref},
    }


def start_state(queue: list, max_questions: int = 10, max_followups: int = 1, phrases: dict | None = None, persona: str = "standard") -> dict:
    qs = queue[:max_questions]
    return {"max_followups": max_followups, "phrases": phrases or {}, "persona": persona, "queue": [{"question": t.question, "kind": t.kind, "ref": t.ref} for t in qs], "asked": 1, "followups_used": 0,
            "current": {"question": qs[0].question, "kind": qs[0].kind, "ref": qs[0].ref} if qs else None}


def notes_plan(notes: str) -> dict:
    """Turn interviewer/company notes into extra questions and a pressure level (rules only)."""
    low = (notes or "").lower()
    rules = preset("notes_rules")
    extras = [{"question": r["question"], "ref": r["ref"]} for r in rules["rules"] if any(m in low for m in r["match"])]
    pressure = 2 if any(c in low for c in rules["pressure_cues"]) else 1
    return {"extras": extras[:2], "max_followups": pressure}


def persona_plan(persona_id: str) -> dict:
    p = next((x for x in preset("personas")["personas"] if x["id"] == persona_id), None) or next(x for x in preset("personas")["personas"] if x["id"] == "standard")
    return {"id": p["id"], "max_followups": p["max_followups"], "extras": p["extras"], "phrases": p["phrases"]}
