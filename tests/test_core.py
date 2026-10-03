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
    iv = Interview(build_queue(extract_claims(CV), ["Tell me about P&L."], 3))
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
