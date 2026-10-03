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


def test_cv_headers_titles_and_dates_are_not_review_lines():
    from interview_ready.cv_analysis import candidate_bullets
    cv = """Danish Hasan
Experience
Head of Talent Acquisition May 2026 – Present
Acme Corporation, London
- Reduced time to hire from 62 to 38 days across 120 roles
Manager – Talent Acquisition Mar 2022 – Jul 2022
Led a team of 8 recruiters and managed a $1.2M agency budget across three regions
Education
MBA, London Business School 2015 – 2017
"""
    got = candidate_bullets(cv)
    assert got == ["Reduced time to hire from 62 to 38 days across 120 roles",
                   "Led a team of 8 recruiters and managed a $1.2M agency budget across three regions"]


def test_title_claims_drop_date_ranges():
    cs = extract_claims("Head of Talent Acquisition May 2026 – Present\nManager – Talent Acquisition Mar 2022 – Jul 2022\n")
    assert [c.text for c in cs if c.type == "title"] == ["Head of Talent Acquisition", "Manager – Talent Acquisition"]


def test_contact_header_lines_are_never_claims_or_review_lines():
    from interview_ready.cv_analysis import candidate_bullets
    cv = """Danish Hasan
Bhopal, India   ·   +91 9981073000   ·   dhasan111@gmail.com   ·   linkedin.com/in/danish
Head of Talent Acquisition
- Reduced time to hire from 62 to 38 days across 120 roles
"""
    assert not any("9981" in c.text or "Bhopal" in c.text for c in extract_claims(cv))
    assert not any("9981" in b or "@" in b for b in candidate_bullets(cv))


def test_claims_are_deduplicated_ranked_and_lists_are_not_claims():
    cv = """EXECUTIVE SUMMARY
14+ Yrs TA & RPO Leadership  ❘  EUR 5M+ P&L Owned  ❘  240+ Consultants Managed
Personally revived a dormant client account into a EUR 5M annual revenue stream and has held full P&L accountability.
AI / LLM: Claude API  ·  Groq (Llama 3.3 70B)  ·  Prompt Engineering  ·  Scoring
Experience
- Revived a dormant client account into an active EUR 5M annual revenue stream through direct relationship rebuilding
- Delivered 250+ hires for a global pharmaceutical enterprise following a competitive RFP win
- Delivered 250+ hires for a global pharmaceutical enterprise following a competitive RFP win, and generated 3 renewals
- Managed recruiter teams and sourcing channels across several concurrent hiring mandates
"""
    cs = extract_claims(cv)
    texts = [c.text for c in cs]
    assert not any("EXECUTIVE SUMMARY" in t for t in texts) and not any("Groq" in t or "Prompt Engineering" in t for t in texts)
    assert any(t.startswith("EUR 5M+ P&L Owned") for t in texts) and any(t.startswith("240+ Consultants") for t in texts)
    assert sum(1 for t in texts if "dormant client account" in t) == 1
    assert sum(1 for t in texts if "250+ hires" in t) == 1 and any("3 renewals" in t for t in texts)  # keeps the richer version
    assert cs[0].type == "metric" and cs[-1].type in ("action", "title")
