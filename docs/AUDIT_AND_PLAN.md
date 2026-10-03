# Audit and plan: is the user actually interview-ready?

Goal: after using the app, a person can walk into **a specific interview** and into **interviews in general** knowing they are ready, and with proof.

## 1. Audit findings (evidence from running the app)

| # | Finding | Evidence | Impact |
|---|---|---|---|
| 1 | **Scoring cannot tell if an answer is relevant.** | An answer about hiking, shaped as headline / 3 points / example / result, scored **10.0 / 10**. | Critical. A false 10 tells someone they are ready when they are not. |
| 2 | **Keyword stuffing passes.** | "Revenue cost margin people operations growth..." scored 8.8 and was credited with the full P&L framework. | High. Frameworks are credited without checking they are used in sentences. |
| 3 | **No concept of a specific interview.** | One global CV and one "latest JD". Only past interviews can be logged (Debrief). Nothing for company, stage, date, interviewer, JD per interview. | Critical for the stated goal. |
| 4 | **No definition of "ready".** | No readiness score, no blockers list, no countdown. Board shows stamps per claim only. | Critical. User cannot tell when to stop or what is left. |
| 5 | **No plan over time.** | Training plan has no dates. Spaced repetition only covers claims. Nothing says "today do this". | High. Preparation before a dated interview needs triage. |
| 6 | **Core questions are missing.** | No bank for: tell me about yourself, why this company, why leaving, strengths and weaknesses, salary, questions for us. | Critical. These are asked in nearly every interview and are the cheapest to prepare. |
| 7 | **No interview-stage awareness.** | HR screen, hiring manager, panel, executive and technical interviews all get the same question mix. | High for specific-interview prep. |
| 8 | **Canned pushback only.** | Follow-ups are fixed phrases, not probes into what the candidate just said. | High. Real interviewers probe the content. |
| 9 | **Feedback is generic.** | Fixes name a problem, not the sentence causing it. | Medium. |
| 10 | **No answer history.** | Answers are stored but never shown. Cannot compare attempt 1 and attempt 3. | Medium. Improvement is not visible. |
| 11 | **Hosted path unproven.** | `SupabaseStore` has no test. Never run against a database. `/api/data` (delete) and `/api/export` are open when deployed without login. | High before deploy. |
| 12 | **Navigation overload.** | 8 flat tabs with no single "what do I do now" screen. | Medium. |
| 13 | **No frontend tests, no scoring calibration set.** | Only backend tests. Scoring thresholds were never checked against labelled answers. | Medium. |

What is solid: CV review rules, claim and gap extraction basics, story bank, training lessons and drills, personas, pressure drills, voice (local), AI plumbing with guards, 28 passing backend tests.

## 2. Plan

Principle: fix the thing that lies first (scoring), then add what makes "ready" measurable (targets, readiness, plan), then fill content gaps (core questions, stages), then depth and hardening.

### Phase 1. Trustworthy scoring
- Relevance guard (rules): answer must touch the question and the CV claim or requirement it tests. Off-topic answers are capped and told why.
- Anti-stuffing: framework credit needs the parts spread across separate sentences.
- Calibration test set of labelled answers (good, mediocre, weak, off-topic, stuffed) with expected score bands. Locked in as tests.
- AI grader (opt-in): answers the question? one-line note, one probing follow-up. Used instead of the canned pushback when available.

### Phase 2. Specific interviews and readiness
- **Targets**: company, role, stage, date, JD, interviewer and company notes. A built-in General target covers overall preparation. One target is active.
- **Readiness engine**: weighted criteria (CV, claims defended, core answers, stories, pressure, plan, recent practice, company research), a score, the top blockers, and days left.
- **Today page**: readiness, countdown, next three actions.
- **Dated study plan**: tasks spread to the interview date, mock sessions pinned to the last days, triage when time is short, with checkboxes.

### Phase 3. Content gaps
- Core question bank with per-question rule checks. Prepared answers saved per target.
- Stage-aware session mix and default interviewer persona (screen, hiring manager, panel, executive, technical).
- Navigation regrouped: Today, Targets, Prepare (hub), Practice, Debrief, Record, Data.

### Phase 4. Depth
- Answer history with attempt comparison.
- Company research checklist (user-entered, nothing fetched from the web).

### Phase 5. Hardening
- Optional `APP_ACCESS_KEY` gate on the API and a one-field unlock screen. Protects data, delete, export and AI quota on a public URL.
- `SupabaseStore` contract tests against an in-memory PostgREST fake.
- Deploy runbook.

## 3. Out of scope for now
Video delivery analysis, peer and coach layer, live web research of the company.
