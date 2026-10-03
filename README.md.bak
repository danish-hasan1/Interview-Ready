# Interview Ready

AI career coach: CV + JD → claim inventory, gap analysis, pressure mock interview, scored feedback, progress profile.
Rules and presets first; the LLM is optional and off by default.

## Layout
- `interview_ready/` Python core (claims, gaps, scoring, interview engine, storage, presets as JSON)
- `api/index.py` FastAPI backend (Vercel Python function)
- `app/`, `components/`, `lib/` Next.js frontend
- `supabase/migrations/` Postgres schema with Row Level Security
- `app.py` legacy Streamlit UI (local only)

## Local dev (no Supabase, SQLite, no login)
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && npm install
.venv/bin/uvicorn api.index:app --port 8000   # terminal 1
npm run dev                                    # terminal 2 -> http://localhost:3000
.venv/bin/python -m pytest
```

## Deploy (Vercel + Supabase), single owner, no login
1. Run `supabase/migrations/0001_init.sql`, then `0002_answer_ref.sql`, then `0003_training.sql`, `0004_library.sql` and `0005_stories_debriefs.sql` and `0006_ai.sql`, in the Supabase SQL editor.
2. Vercel env vars (see `.env.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side only).
3. Import the GitHub repo in Vercel. Framework: Next.js. `vercel.ts` routes `/api/*` to the Python function.
4. **Turn on Vercel Deployment Protection** (Project Settings -> Deployment Protection). The app has no login, so this is what keeps your CV private.

## Voice answers (local only)
`pip install -r requirements-voice.txt` (faster-whisper, tiny English model downloads on first use). The Practice screen then shows "Answer by voice". Audio is transcribed in memory on your machine and never stored. Not available on Vercel.

## AI (Groq, opt-in)
Put `GROQ_API_KEY=...` in `.env.local` (git-ignored; the API reads it) or in Vercel env vars. Never `NEXT_PUBLIC_`. AI stays off until you enable it in the app and tick a consent box that shows the exact redacted text.
- Used for: CV review (seniority read, risks, rewrites, hard questions), answer coaching, custom questions, story tightening. Scoring stays rule-based.
- Redaction removes emails, phones, links, addresses and the name line before anything is sent. Figures are kept.
- Guards: rewrites must beat the rule score, invented figures are discarded, identical requests are cached, `AI_DAILY_CAP` bounds spend (unset = no cap).
- **Deployed with no login, anyone with the URL can use your quota. Turn on Vercel Deployment Protection and set `AI_DAILY_CAP`.**

## Optional local model (off by default)
Rules score every answer. To add a one-line coach note from a local model: `ollama pull llama3.2`, then run the API with `INTERVIEW_READY_LLM=ollama`.
Resolution order: approved library note, then model, else nothing. Notes you approve in Your data are reused, so the model is needed less over time. Never available on Vercel.

## Privacy
Hosted mode stores CV text and answers in your Supabase project. Tables have RLS on with no policies, so only the server (service-role key) can read them. Export and delete-all live in the Profile tab. No external LLM calls.
