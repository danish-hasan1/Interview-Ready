import json

import httpx
import pytest

from interview_ready import ai, config
from interview_ready.db import Store
from interview_ready.llm_provider import GroqProvider, LLMProvider, LLMUnavailable

CV = """Jane Public
jane@mail.com | +44 7700 900123
Head of Talent Acquisition
- Responsible for helping the team with various hiring processes across the business
- Reduced time to hire from 62 to 38 days across 120 roles
"""


class Fake(LLMProvider):
    def __init__(self, payload):
        self.payload, self.calls = payload, 0

    def complete(self, prompt, system="", json_mode=False):
        self.calls += 1
        self.last_prompt = prompt
        return json.dumps(self.payload) if not isinstance(self.payload, str) else self.payload


def good():
    return {"seniority": "Senior, team lead scope.", "summary": "s", "risks": ["No baseline for the 38 days claim."],
            "rewrites": [
                {"original": "Responsible for helping the team with various hiring processes across the business",
                 "rewrite": "Led hiring for [N] teams, cutting time to hire from 62 to 38 days", "why": "shows the result"},
                {"original": "Reduced time to hire from 62 to 38 days across 120 roles", "rewrite": "Cut time to hire from 62 to 38 days, saving $9M", "why": "invented"},
                {"original": "A line that is not on the CV", "rewrite": "Led 5 things", "why": "fake"}],
            "hard_questions": ["q1 about the 62 to 38 days"], "missing_evidence": ["P&L ownership"]}


def test_cv_review_filters_and_never_sends_contact_details():
    s = Store(":memory:")
    f = Fake(good())
    r = ai.ai_cv_review(s, CV, "", f)
    assert "jane@mail.com" not in f.last_prompt and "7700" not in f.last_prompt and "Jane Public" not in f.last_prompt
    assert len(r["rewrites"]) == 1 and r["rewrites"][0]["needs_figure"] and r["rewrites"][0]["after"] > r["rewrites"][0]["before"]
    assert r["dropped"] == 2 and r["redacted"]["emails"] == 1
    assert ai.ai_cv_review(s, CV, "", f) and f.calls == 1  # second identical call is served from cache


def test_bad_json_and_cap(monkeypatch):
    s = Store(":memory:")
    with pytest.raises(ai.AIBadOutput):
        ai.ai_cv_review(s, CV, "", Fake("not json at all"))
    s = Store(":memory:")  # failed calls still count toward the cap, so start clean
    monkeypatch.setattr(config, "AI_DAILY_CAP", 1)
    f = Fake(good())
    ai.ai_cv_review(s, CV + "x", "", f)
    with pytest.raises(ai.AILimit):
        ai.ai_cv_review(s, CV + "y", "", Fake(good()))


def test_settings_require_consent_and_key(monkeypatch):
    s = Store(":memory:")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with pytest.raises(ai.AIDisabled):
        ai.save_settings(s, True, False, None)
    st = ai.save_settings(s, True, True, {"coaching": False})
    assert st["enabled"] and not st["configured"] and not ai.is_on(s, "cv_review")
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    assert ai.is_on(s, "cv_review") and not ai.is_on(s, "coaching")
    with pytest.raises(ai.AIDisabled):
        ai.call_json(s, "coaching", "x", "y")


def test_questions_and_story_guards():
    s = Store(":memory:")
    qs = ai.ai_questions(s, CV, "", Fake({"questions": [{"question": "You say you cut hiring from 62 to 38 days. What was the baseline?", "about": "Reduced time"}]}))
    assert qs[0]["ref"] == "Reduced time"
    fields = {"context": "In 2023 at Acme", "problem": "Agency spend 40% over budget", "action": "I cut suppliers from 14 to 3",
              "result": "Spend fell 31%", "impact": "Saved $380k a year"}
    ok = ai.ai_tighten_story(s, "commercial", fields, Fake({"fields": {**fields, "context": "In 2023 at Acme, hiring spend was rising"}, "note": "tightened"}))
    assert ok["fields"]["context"].startswith("In 2023")
    with pytest.raises(ai.AIBadOutput):
        ai.ai_tighten_story(Store(":memory:"), "commercial", fields, Fake({"fields": {**fields, "result": "Spend fell 55%"}}))


def test_groq_provider_request_and_errors(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    seen = {}

    def handler(req: httpx.Request):
        seen["auth"], seen["body"] = req.headers["authorization"], json.loads(req.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": " hi "}}]})

    p = GroqProvider(transport=httpx.MockTransport(handler))
    assert p.complete("u", "sys", json_mode=True) == "hi"
    assert seen["auth"] == "Bearer test-key" and seen["body"]["response_format"] == {"type": "json_object"}
    assert seen["body"]["messages"][0]["role"] == "system"
    bad = GroqProvider(transport=httpx.MockTransport(lambda r: httpx.Response(401)))
    with pytest.raises(LLMUnavailable) as e:
        bad.complete("secret cv text")
    assert "secret" not in str(e.value) and "test-key" not in str(e.value)
    monkeypatch.delenv("GROQ_API_KEY")
    with pytest.raises(LLMUnavailable):
        GroqProvider().complete("x")


def test_redaction_keeps_figures():
    from interview_ready.redact import redact_cv
    r = redact_cv("Managed $1.2M budget, saved 120000 and 31% across 120 roles. Call +44 7700 900123 or a@b.co")
    assert "$1.2M" in r["text"] and "120000" in r["text"] and "31%" in r["text"] and "[PHONE]" in r["text"] and "[EMAIL]" in r["text"]
