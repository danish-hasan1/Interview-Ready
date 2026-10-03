"""Readiness: what 'ready for this interview' means, measured from evidence, with the top blockers."""
from datetime import datetime, timedelta, timezone

from . import core, targets as tg
from .claims import extract_claims
from .cv_analysis import analyse_cv
from .gaps import analyse_gaps
from .spaced import due_items
from .status_rules import SOLID_AT
from .stories import coverage as story_coverage
from .training import build_plan

WEIGHTS = {
    "general": {"cv": 10, "claims": 25, "core": 15, "stories": 10, "training": 10, "pressure": 5, "practice": 10, "quality": 15},
    "interview": {"cv": 8, "claims": 18, "gaps": 10, "core": 14, "stories": 8, "training": 6, "pressure": 5, "practice": 10, "quality": 11, "research": 10},
}


def _parse(s):
    try:
        d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def compute(store, target: dict, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    kind = "general" if target["kind"] == "general" else "interview"
    cv_doc = store.latest_document("cv")
    prof = store.profile()
    refs = prof["refs"]
    crit = {}

    def add(cid, label, value, detail, page, action):
        crit[cid] = {"id": cid, "label": label, "weight": WEIGHTS[kind][cid], "value": max(0.0, min(1.0, value)), "detail": detail,
                     "page": page, "action": action}

    cv_score, claims, gaps, review = 0, [], [], None
    if cv_doc:
        review = analyse_cv(cv_doc["text"])
        cv_score = review["score"]
        claims = extract_claims(cv_doc["text"])
        if kind == "interview" and target.get("jd_text"):
            gaps = analyse_gaps(cv_doc["text"], target["jd_text"])
    add("cv", "CV reads as proof", cv_score / 85 if cv_doc else 0,
        f"CV score {cv_score}/100" if cv_doc else "No CV uploaded yet", "prepare:review", "Review and fix your CV")

    top = sorted([c for c in claims if c.type == "metric"], key=lambda c: -len(c.numbers))[:6] or claims[:6]
    solid = sum(1 for c in top if refs.get(c.text, {}).get("last", 0) >= SOLID_AT)
    add("claims", "Top claims defended", solid / len(top) if top else 0,
        f"{solid} of {len(top)} top claims are solid" if top else "No claims found yet", "board", "Drill your untested claims")

    if kind == "interview":
        open_gaps = [g for g in gaps if g.status != "evidenced"]
        gs = sum(1 for g in open_gaps if refs.get(g.requirement, {}).get("last", 0) >= SOLID_AT)
        add("gaps", "Role gaps answered", (gs / len(open_gaps)) if open_gaps else (1.0 if gaps else 0.0),
            f"{gs} of {len(open_gaps)} gaps answered well" if open_gaps else ("No gaps against this role" if gaps else "Add the job description to this target"),
            "board" if gaps else "targets", "Drill the role gaps" if gaps else "Add the job description")

    stage = target.get("stage") or "general"
    needed = core.stage_ids(stage if kind == "interview" else "general")
    prepared = {p["question_id"]: p for p in store.list_prepared(target["id"])}
    ready = sum(1 for q in needed if prepared.get(q, {}).get("score", 0) >= SOLID_AT)
    add("core", "Core answers prepared", ready / len(needed), f"{ready} of {len(needed)} core answers ready", "prepare:core", "Write your core answers")

    cov = story_coverage(store.list_stories())
    add("stories", "Stories ready", min(1.0, cov["core_ready"] / 3), f"{cov['core_ready']} of 5 core stories ready (3 is enough)", "prepare:stories", "Write a story")

    plan = build_plan(review, gaps, prof) if review else []
    tp = store.training_progress()
    done = sum(1 for p in plan if tp.get(p["lesson_id"], {}).get("best", 0) >= SOLID_AT)
    add("training", "Training plan done", done / len(plan) if plan else 0,
        f"{done} of {len(plan)} lessons done" if plan else "Upload a CV to get a plan", "prepare:train", "Do your next lesson")

    add("pressure", "Recover under pressure", tp.get("pressure_drill", {}).get("best", 0) / 8,
        f"Best pressure drill {tp.get('pressure_drill', {}).get('best', 0)}/10 (8 is full marks)", "prepare:train", "Run the pressure drills")

    week = [s for s in prof["sessions"] if (_parse(s["created"]) or now) >= now - timedelta(days=7)]
    add("practice", "Recent practice", len(week) / 3, f"{len(week)} practice session{'s' if len(week) != 1 else ''} in the last 7 days (3 is full)",
        "practice", "Run a mock interview")

    dims = prof["dims"]
    avg = sum(dims.values()) / len(dims) if dims else 0
    add("quality", "Answer quality", avg / 8, f"Average answer score {avg:.1f}/10 (8 is full marks)" if dims else "No scored answers yet", "practice", "Practise and raise your weakest dimension")

    if kind == "interview":
        r = tg.research_done(target)
        add("research", "Company research", r, f"{round(r * 100)}% of the research checklist filled", "targets", "Complete the research checklist")

    raw = sum(c["weight"] * c["value"] for c in crit.values())
    cap, why_cap = 100, ""
    if prof["answers"] == 0:
        cap, why_cap = 40, "Capped at 40 until you have answered practice questions."
    elif prof["answers"] < 6:
        cap, why_cap = 60, "Capped at 60 until you have answered at least 6 practice questions."
    score = round(min(raw, cap))
    blockers = sorted(crit.values(), key=lambda c: -(c["weight"] * (1 - c["value"])))
    blockers = [b for b in blockers if b["value"] < 0.85][:3]
    label = "Ready" if score >= 85 else "Nearly ready" if score >= 65 else "Getting there" if score >= 40 else "Not ready yet"
    return {"score": score, "label": label, "cap_note": why_cap if raw > cap else "", "criteria": list(crit.values()), "blockers": blockers,
            "days_left": tg.days_left(target), "due_count": len(due_items(refs, now)),
            "context": {"top_claims": [c.text for c in top], "open_gaps": [g.requirement for g in gaps if g.status != "evidenced"],
                        "missing_core": [q for q in needed if prepared.get(q, {}).get("score", 0) < SOLID_AT],
                        "missing_stories": cov["missing_core"], "plan_lessons": plan, "cv_score": cv_score, "has_cv": bool(cv_doc),
                        "pressure_best": tp.get("pressure_drill", {}).get("best", 0), "refs": {k: v for k, v in refs.items()}}}
