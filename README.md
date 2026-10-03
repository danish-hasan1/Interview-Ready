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
1. Run `supabase/migrations/0001_init.sql`, then `0002_answer_ref.sql`, in the Supabase SQL editor.
2. Vercel env vars (see `.env.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side only).
3. Import the GitHub repo in Vercel. Framework: Next.js. `vercel.ts` routes `/api/*` to the Python function.
4. **Turn on Vercel Deployment Protection** (Project Settings -> Deployment Protection). The app has no login, so this is what keeps your CV private.

## Privacy
Hosted mode stores CV text and answers in your Supabase project. Tables have RLS on with no policies, so only the server (service-role key) can read them. Export and delete-all live in the Profile tab. No external LLM calls.
