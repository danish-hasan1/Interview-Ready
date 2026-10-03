-- Interview Ready V1. Every row belongs to auth.uid(); RLS blocks cross-user access.
create table if not exists documents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('cv','jd')),
  name text, text text not null,
  created timestamptz not null default now()
);
create table if not exists claims (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  doc_id bigint references documents(id) on delete cascade,
  text text not null, type text not null,
  numbers jsonb not null default '[]', ownership text not null default 'Contributed'
);
create table if not exists sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text default '', notes text default '',
  created timestamptz not null default now()
);
create table if not exists answers (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id bigint references sessions(id) on delete cascade,
  question text, kind text, answer text,
  dims jsonb not null, fixes jsonb not null default '[]', total numeric not null,
  created timestamptz not null default now()
);

create index if not exists documents_user_idx on documents(user_id);
create index if not exists claims_user_idx on claims(user_id);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists answers_user_idx on answers(user_id);
create index if not exists answers_session_idx on answers(session_id);

alter table documents enable row level security;
alter table claims enable row level security;
alter table sessions enable row level security;
alter table answers enable row level security;

do $$
declare t text;
begin
  foreach t in array array['documents','claims','sessions','answers'] loop
    execute format('create policy "%1$s_own" on %1$s for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
