# Deploy runbook: Vercel + Supabase

The code is tested against an in-memory PostgREST fake (`tests/fake_postgrest.py`). That proves request shapes and logic, not
row-level security or SQL types. Do steps 1 to 4 once, then run the smoke checklist before relying on it.

## 1. Supabase
1. Create a project (or use `smdqgqhurvonvegvcnuh`).
2. SQL editor: run every file in `supabase/migrations/` in order, `0001` to `0007`.
3. Settings → API: copy the project URL and the **service_role** key. Never expose the service-role key to the browser.

## 2. Vercel
1. Import the GitHub repo. Framework: Next.js.
2. Environment variables (Production and Preview):

| Name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | project URL | server only |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key | server only, never `NEXT_PUBLIC_` |
| `APP_ACCESS_KEY` | 20+ random characters | **required**: the app has no login |
| `GROQ_API_KEY` | your Groq key | optional, AI stays off until opted in |
| `AI_DAILY_CAP` | e.g. `50` | optional, strongly advised on a public URL |

3. Project Settings → Deployment Protection: turn it on as a second lock.

## 3. Why the gate matters
There is no user login. Without `APP_ACCESS_KEY` and Deployment Protection, anyone with the URL could read your CV, delete all data
(`DELETE /api/data`) and spend your Groq quota. With `APP_ACCESS_KEY` set every `/api/*` call except `/api/health` and `/api/access`
needs the `x-access-key` header. The app asks for the key once and keeps it in that browser.

## 4. Smoke checklist after the first deploy
- [ ] Open the URL: unlock screen appears, wrong key is rejected, right key opens Today.
- [ ] `/api/health` returns `{"ok": true, "hosted": true}` (hosted must be true).
- [ ] Upload a CV: claims appear. Reload: the CV is still there (persisted in Supabase).
- [ ] Add an interview with a date and job description: Today shows a countdown and a plan.
- [ ] Save a core answer; reload; it is still ready.
- [ ] Practice: answer a question; Record shows it; Defence board stamp updates.
- [ ] Your data → Export works; Delete all empties every screen.
- [ ] AI (if configured): turn on, run a CV review, check Supabase `llm_cache` and `ai_usage` rows appear.
- [ ] If `/api/*` returns 404 on Vercel, check the rewrite in `vercel.ts` (`/api/(.*)` → `/api/index`).

## 5. Local run
`.venv/bin/uvicorn api.index:app --port 8000` and `npm run dev`. Put keys in `.env.local` (git-ignored).
