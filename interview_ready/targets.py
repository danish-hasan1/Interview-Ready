"""Targets: the specific interviews you are preparing for, plus a built-in General target."""
from datetime import date, datetime

from .config import preset
from .core import bank

STAGES = list(bank()["stages"].keys())


def ensure_general(store) -> dict:
    """Make sure the General target exists, and migrate a legacy standalone JD into a target once."""
    ts = store.list_targets()
    if not any(t["kind"] == "general" for t in ts):
        gid = store.save_target(None, "general", "", "", "general", "", "", "", {})
        store.set_setting("active_target", gid)
        ts = store.list_targets()
    if len(ts) == 1 and not store.get_setting("jd_migrated", False):
        jd = store.latest_document("jd")
        store.set_setting("jd_migrated", True)
        if jd and jd.get("text", "").strip():
            tid = store.save_target(None, "interview", "", "Target role", "hiring_manager", "", jd["text"], "", {})
            store.set_setting("active_target", tid)
            ts = store.list_targets()
    return {"targets": ts}


def active(store) -> dict:
    ts = ensure_general(store)["targets"]
    aid = store.get_setting("active_target")
    return next((t for t in ts if t["id"] == aid), None) or next(t for t in ts if t["kind"] == "general")


def days_left(target: dict, today: date | None = None):
    d = target.get("interview_date")
    if not d:
        return None
    try:
        when = datetime.fromisoformat(str(d)[:10]).date()
    except ValueError:
        return None
    return (when - (today or date.today())).days


def research_fields() -> list:
    return preset("company_research")["fields"]


def research_done(target: dict) -> float:
    r = target.get("research") or {}
    fields = research_fields()
    return sum(1 for f in fields if (r.get(f["key"]) or "").strip()) / len(fields)
