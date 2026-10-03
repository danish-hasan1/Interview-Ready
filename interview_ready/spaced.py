"""Spaced repetition for claims and role gaps: weak items resurface until they are solid."""
from datetime import datetime, timedelta, timezone

from .status_rules import SOLID_AT

SHAKY_DAYS = [0, 1, 2, 4, 7]
SOLID_DAYS = [3, 7, 14, 30]


def _parse(s: str):
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def due_items(refs: dict, now: datetime | None = None) -> list:
    now = now or datetime.now(timezone.utc)
    out = []
    for ref, r in refs.items():
        last = _parse(r.get("last_at", ""))
        if not last:
            continue
        shaky = r["last"] < SOLID_AT
        sched = SHAKY_DAYS if shaky else SOLID_DAYS
        due_at = last + timedelta(days=sched[min(max(r["attempts"], 1) - 1, len(sched) - 1)])
        if now >= due_at:
            out.append({"ref": ref, "state": "shaky" if shaky else "solid", "last": r["last"], "attempts": r["attempts"],
                        "overdue_days": max(0, (now - due_at).days), "due_at": due_at.isoformat(timespec="seconds")})
    return sorted(out, key=lambda x: (x["state"] != "shaky", x["last"]))
