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

## Deploy (Vercel + Supabase)
1. Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor.
2. Supabase Auth: enable email provider; add the Vercel URL under Auth → URL configuration.
3. Vercel env vars (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
   Never add the service-role key; the API uses each caller's JWT so RLS isolates users.
4. Import the GitHub repo in Vercel. Framework: Next.js. `vercel.ts` routes `/api/*` to the Python function.

## Privacy
Hosted mode stores CV text and answers in your Supabase project, per user, behind RLS. Export and delete-all live in the Profile tab. No external LLM calls.
