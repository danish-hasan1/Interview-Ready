from interview_ready.claims import extract_claims
from interview_ready.db import Store
from interview_ready.gaps import analyse_gaps
from interview_ready.interview import Interview, build_queue
from interview_ready.scoring import score_answer

CV = """Head of Talent Acquisition
- Reduced time to hire from 62 to 38 days across 120 roles
- Led a team of 8 recruiters and managed a $1.2M agency budget
- Built an employer brand programme
"""
JD = """- Proven experience reducing time to hire
- Strong P&L ownership and commercial acumen
- Experience with workforce planning
"""


def test_claims_have_metric_and_questions():
    claims = extract_claims(CV)
    assert any(c.type == "metric" and c.numbers for c in claims)
    assert all(c.questions for c in claims)


def test_gaps_flag_missing_pl():
    gaps = {g.requirement: g.status for g in analyse_gaps(CV, JD)}
    assert gaps["Strong P&L ownership and commercial acumen"] != "evidenced"
    assert gaps["Proven experience reducing time to hire"] != "missing"


def test_scoring_rewards_structure_and_numbers():
    good = ("I cut time to hire by 39%. First, I redesigned sourcing. Second, I automated screening. "
            "Third, I trained managers. For example, at my last company this saved $200k. The result was 38 days.")
    bad = "Um, basically we did stuff, you know, like things with the team."
    g, b = score_answer(good), score_answer(bad)
    assert g.total > b.total
    assert b.fixes


def test_interview_pressure_followup_and_finish():
    iv = Interview(build_queue(extract_claims(CV), [{"question": "Tell me about P&L.", "ref": "P&L"}], 3))
    iv.start()
    score, nxt = iv.answer("We did some things.")
    assert nxt.kind == "followup"
    for _ in range(10):
        if iv.done:
            break
        iv.answer("I cut it by 30%. First a. Second b. Third c. For example at X. Result: saved $1m revenue.")
    assert iv.done


def test_store_roundtrip_export_delete():
    s = Store(":memory:")
    sid = s.new_session()
    s.save_answer(sid, "q", "claim", "a", score_answer("I did 3 things."))
    assert s.session_summaries() and s.weaknesses()
    assert s.export_all()["answers"]
    s.delete_all()
    assert not s.session_summaries()


def test_cv_analysis_flags_weak_lines_and_plans():
    from interview_ready.cv_analysis import analyse_cv, review_bullet
    from interview_ready.training import build_plan
    cv = """Summary
Experienced recruiter.
Experience
- Responsible for helping the team with various hiring processes and stuff
- Worked on improving things for different departments across the company
- Reduced time to hire from 62 to 38 days across 120 roles
"""
    r = analyse_cv(cv)
    assert r["findings"] and r["categories"]["impact"] < 100
    assert any("Weak phrasing" in i for b in r["bullets_to_fix"] for i in b["issues"])
    assert review_bullet("Reduced time to hire from 62 to 38 days across 120 roles").score >= 80
    plan = build_plan(r, analyse_gaps(CV, JD), {"dims": {"structure": 3}})
    ids = [p["lesson_id"] for p in plan]
    assert "structure" in ids and "own_it" in ids
    assert len(ids) == len(set(ids))


def test_training_checks():
    from interview_ready.training import check_build, check_rewrite
    out = check_rewrite("Worked on hiring", "Cut time to hire from 62 to 38 days across 120 roles by redesigning screening")
    assert out["improved"] and out["after"] > out["before"]
    res = check_build("structure", {"headline": "I cut time to hire by 39%.", "p1": "sourcing", "p2": "screening", "p3": "training",
                                      "example": "At my last company this saved 11 days", "result": "38 days across 120 roles"})
    assert res["score"] > 0 and all(f["ok"] for f in res["fields"])
    bad = check_build("structure", {"headline": ""})
    assert not bad["pass"]


def test_business_and_advisory_frameworks_recognised():
    biz = ("Revenue: unfilled roles cost $60k a month. Cost: cost per hire fell 24%. Margin: savings added 0.4 points. "
           "People: retention rose to 91%. Operations: each recruiter handles 22 reqs. Growth: we staffed a new region.")
    s = score_answer(biz, "How does talent acquisition affect the P&L?")
    assert "Revenue" in s.framework and s.dims["structure"] >= 8
    adv = ("Diagnosis: the root cause is late-stage drop-off. I'd analyse stage data. I recommend a faster panel. "
           "To implement: three steps within 6 weeks. I'd measure time to hire against a 40 day target.")
    s2 = score_answer(adv, "What would you do about slow hiring?")
    assert "Diagnose" in s2.framework
    weak = score_answer("We did some things and hired people.", "How does hiring affect margin and the P&L?")
    assert any("frame" in f and "missing" in f for f in weak.fixes)


def test_claim_keywords_and_notes_plan():
    from interview_ready.interview import notes_plan
    c = extract_claims("- Led a $1.2M agency budget across EMEA with Workday and Greenhouse ATS")[0]
    assert any(k in c.keywords for k in ["EMEA", "Workday", "ATS", "budget"])
    p = notes_plan("CEO is tough and blunt, finance background")
    assert p["max_followups"] == 2 and p["extras"]
    assert notes_plan("")["max_followups"] == 1
