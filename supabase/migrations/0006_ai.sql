-- AI layer: opt-in settings, daily usage counter, response cache. Single owner, service-role only.
create table if not exists settings (key text primary key, value jsonb not null);
create table if not exists ai_usage (day text primary key, count integer not null default 0);
create table if not exists llm_cache (key text primary key, value text not null, created timestamptz not null default now());
alter table settings enable row level security;
alter table ai_usage enable row level security;
alter table llm_cache enable row level security;
