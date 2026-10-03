"""Dated study plan: turns readiness blockers into tasks spread to the interview date."""
import hashlib
from datetime import date, timedelta

from .core import bank, question
from .stories import themes

DAY_MINUTES = 60


def _h(s: str) -> str:
    return hashlib.sha1(s.encode()).hexdigest()[:8]


def build_tasks(r: dict, stage_label: str) -> list:
    """Unscheduled tasks in priority order. Ids are stable so ticks survive regeneration."""
    ctx = r["context"]
    tasks = []

    def t(tid, title, minutes, page, priority, detail=""):
        tasks.append({"id": tid, "title": title, "minutes": minutes, "page": page, "priority": priority, "detail": detail})

    if not ctx["has_cv"]:
        t("cv:upload", "Upload your CV", 5, "board", 0)
    elif ctx["cv_score"] < 75:
        t("cv:review", "Fix the weakest lines on your CV", 20, "prepare:review", 1, f"CV score is {ctx['cv_score']}/100")
    refs = ctx["refs"]
    claims = [c for c in ctx["top_claims"] if refs.get(c, {}).get("last", 0) < 6][:5]
    for i, c in enumerate(claims):
        t(f"drill:{_h(c)}", f"Drill: {c[:70]}", 10, "drill:" + c, 2 + i * 0.1, "Be able to say what it means, how it was measured, the baseline and your part.")
    for g in ctx["open_gaps"][:3]:
        t(f"gap:{_h(g)}", f"Answer the gap: {g[:70]}", 10, "drill:" + g, 2.5, "The role asks for this and your CV does not prove it.")
    for q in ctx["missing_core"]:
        label = question(q)["label"] if question(q) else q
        t(f"core:{q}", f"Write your answer: {label}", 8, "prepare:core", 3)
    th = {x["id"]: x["label"] for x in themes()["themes"]}
    for s in ctx["missing_stories"][:3]:
        t(f"story:{s}", f"Write a story: {th.get(s, s)}", 12, "prepare:stories", 4)
    for p in ctx["plan_lessons"][:4]:
        t(f"lesson:{p['lesson_id']}", f"Lesson: {p['title']}", p["minutes"], "lesson:" + p["lesson_id"], 3.5, p["reason"])
    if ctx["pressure_best"] < 8:
        t("pressure", "Run the pressure drills", 10, "prepare:train", 4.5, "Six timed rounds. Recovering calmly is remembered.")
    if r["criteria"] and any(c["id"] == "research" and c["value"] < 1 for c in r["criteria"]):
        t("research", "Research the company and interviewers", 25, "targets", 1.5, "Fill the research checklist. Read their latest announcement.")
    return sorted(tasks, key=lambda x: x["priority"])


def schedule(tasks: list, days_left: int | None, done: set, today: date | None = None) -> dict:
    today = today or date.today()
    horizon = max(1, days_left) if days_left is not None and days_left >= 0 else 7
    pinned = []
    if days_left is not None and days_left >= 0:
        n_mock = 3 if horizon >= 5 else 2 if horizon >= 3 else 1
        for i in range(n_mock):
            off = max(0, horizon - 1 - (n_mock - 1 - i))
            pinned.append({"id": f"mock:{i + 1}", "title": f"Full mock interview {i + 1}", "minutes": 25, "page": "practice", "priority": 0,
                           "detail": "Real conditions: timer, no notes, then read the assessment.", "day": off})
        if horizon >= 2:
            pinned.append({"id": "brief", "title": "Read your interview brief", "minutes": 10, "page": "brief", "priority": 0,
                           "detail": "The night before and an hour before.", "day": horizon - 1})
    else:
        for i in range(2):
            pinned.append({"id": f"mock:{i + 1}", "title": f"Full mock interview {i + 1}", "minutes": 25, "page": "practice", "priority": 0,
                           "detail": "Real conditions, then read the assessment.", "day": 2 + i * 3})

    load = [0] * horizon
    for p in pinned:
        load[min(p["day"], horizon - 1)] += p["minutes"]
    scheduled = list(pinned)
    later = []
    day = 0
    for tk in tasks:
        if tk["id"] in done:
            scheduled.append({**tk, "day": 0})  # keep ticked tasks visible as done on day 0
            continue
        while day < horizon and load[day] + tk["minutes"] > DAY_MINUTES and load[day] > 0:
            day += 1
        if day >= horizon:
            later.append(tk)
            continue
        load[day] += tk["minutes"]
        scheduled.append({**tk, "day": day})
    out = []
    for s in scheduled + [{**x, "day": None} for x in later]:
        d = s.get("day")
        out.append({**s, "due": (today + timedelta(days=d)).isoformat() if d is not None else None, "done": s["id"] in done})
    return {"tasks": sorted(out, key=lambda x: (x["day"] is None, x["day"] or 0, x["priority"])), "horizon": horizon,
            "triage": bool(later), "later_count": len(later)}
