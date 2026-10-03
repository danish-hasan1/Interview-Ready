"""Mock interview engine: question queue from CV claims + JD gaps, pressure follow-ups."""
from dataclasses import dataclass, field

from .claims import Claim
from .config import preset
from .scoring import follow_up_for, score_answer


@dataclass
class Turn:
    question: str
    kind: str  # claim | gap | followup


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
            self.current = Turn(preset("pressure")[key], "followup")
            return score, self.current
        return score, self._next_main()


def build_queue(claims: list, gap_qs: list, max_questions: int = 6) -> list:
    """Interleave claim questions (one per claim, rotating) with gap questions."""
    claim_turns = []
    for c in claims:
        if c.questions:
            claim_turns.append(Turn(c.questions[0], "claim"))
    gap_turns = [Turn(q, "gap") for q in gap_qs]
    queue, ci, gi = [], 0, 0
    while len(queue) < max_questions and (ci < len(claim_turns) or gi < len(gap_turns)):
        if ci < len(claim_turns):
            queue.append(claim_turns[ci]); ci += 1
        if ci < len(claim_turns) and len(queue) < max_questions:
            queue.append(claim_turns[ci]); ci += 1
        if gi < len(gap_turns) and len(queue) < max_questions:
            queue.append(gap_turns[gi]); gi += 1
    return queue


def step(state: dict, answer: str, max_questions: int = 6, max_followups: int = 1):
    """Stateless version for the API. state = {queue, asked, followups_used, current}.
    Returns (score, new_state); new_state['current'] is None when finished."""
    queue = [Turn(**t) for t in state["queue"]]
    cur = Turn(**state["current"])
    asked, used = state["asked"], state["followups_used"]
    score = score_answer(answer)
    key = follow_up_for(answer, score) if cur.kind != "followup" and used < max_followups else None
    if key:
        nxt, used = Turn(preset("pressure")[key], "followup"), used + 1
    elif asked >= min(max_questions, len(queue)):
        nxt = None
    else:
        nxt, asked, used = queue[asked], asked + 1, 0
    return score, {
        "queue": state["queue"], "asked": asked, "followups_used": used,
        "current": None if nxt is None else {"question": nxt.question, "kind": nxt.kind},
    }


def start_state(queue: list, max_questions: int = 6) -> dict:
    qs = queue[:max_questions]
    return {"queue": [{"question": t.question, "kind": t.kind} for t in qs], "asked": 1, "followups_used": 0,
            "current": {"question": qs[0].question, "kind": qs[0].kind} if qs else None}
