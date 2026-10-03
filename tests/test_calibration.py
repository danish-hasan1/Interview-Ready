"""Scoring calibration. Labelled answers must land in their expected band, so scoring cannot drift into
telling an unready person they are ready (or the reverse). Edit bands only with a reason."""
import pytest

from interview_ready.scoring import score_answer

CLAIM = "Reduced time to hire from 62 to 38 days across 120 roles"
Q_BASE = "What was the baseline before you started?"
Q_PL = "How does talent acquisition affect the P&L in your company?"
Q_STRAT = "Engineering hiring is too slow. What would you do?"

CASES = [
    # (label, question, ref, kind, answer, min, max)
    ("strong claim defence", Q_BASE, CLAIM, "claim",
     "The baseline was 62 days from application to signed offer, measured in our ATS and signed off by Finance. "
     "I took it to 38 days over twelve months. First, I rebuilt sourcing. Second, I automated screening. Third, I trained hiring managers. "
     "For example, automating screening alone saved 11 days across 120 roles. The result was roughly $0.4M a year in vacancy cost.", 8, 10),
    ("good but no impact", Q_BASE, CLAIM, "claim",
     "The baseline was 62 days to hire across our 120 roles, measured from application to signed offer. I redesigned screening and the team ran sourcing. "
     "We got it to 38 days over twelve months by tightening the interview loop and moving to structured scorecards.", 5, 8.5),
    ("vague and filler", Q_BASE, CLAIM, "claim",
     "Um, basically it was kind of slow and we did a lot of things with the team, you know, and it got better over time.", 0, 3),
    ("off topic but well structured", Q_BASE, CLAIM, "claim",
     "I love hiking. First, I plan the route carefully. Second, I check the weather forecast. Third, I pack the right gear. "
     "For example, in 2023 I hiked 12 peaks and saved $200 on equipment. The result was a great summer and better fitness.", 0, 3.5),
    ("too short", Q_BASE, CLAIM, "claim", "It was 62 days and then 38.", 0, 5),
    ("keyword stuffed framework", Q_PL, "", "gap",
     "Revenue cost margin people operations growth. I led it. First second third. For example 12%. Result 38 days.", 0, 5.5),
    ("proper business framework", Q_PL, "", "gap",
     "Revenue: unfilled sales roles cost about $60k each per month, so speed protects revenue. Cost: cost per hire fell 24% after we cut agencies from 14 to 3. "
     "Margin: that added roughly 0.4 points to operating margin. People: first-year retention rose to 91%. Operations: each recruiter now carries 22 requisitions. "
     "Growth: we staffed the new region in one quarter.", 7.5, 10),
    ("proper advisory frame", Q_STRAT, "", "gap",
     "Diagnosis: the root cause is late-stage drop-off, not sourcing. I'd analyse stage conversion and offer acceptance data first. "
     "I recommend a faster panel and a pay review for two roles. To implement, three steps within 6 weeks with hiring managers as owners. "
     "I'd measure time to hire against a 40 day target and acceptance above 85%.", 7, 10),
    ("empty", Q_BASE, CLAIM, "claim", "", 0, 2),
]


@pytest.mark.parametrize("label,q,ref,kind,answer,lo,hi", CASES, ids=[c[0] for c in CASES])
def test_score_band(label, q, ref, kind, answer, lo, hi):
    s = score_answer(answer, q, ref, kind)
    assert lo <= s.total <= hi, f"{label}: scored {s.total}, expected {lo}..{hi}; dims={s.dims} relevance={s.relevance}"


def test_off_topic_names_the_missing_terms():
    s = score_answer("I love hiking and camping with friends every single weekend of the summer season.", Q_BASE, CLAIM, "claim")
    assert s.relevance["level"] == "off" and "does not answer" in s.fixes[0] and s.total <= 3


def test_gap_and_followup_answers_are_never_marked_off_topic():
    ans = "I managed a 1.2M budget, cut agency cost by 31% and protected margin across three regions in my last role."
    assert score_answer(ans, "Where have you shown commercial ownership?", "Strong P&L ownership and commercial acumen", "gap").relevance["level"] == "on"
    assert score_answer("About 38 days, I think.", "Give me a number.", CLAIM, "followup").relevance["level"] == "on"
