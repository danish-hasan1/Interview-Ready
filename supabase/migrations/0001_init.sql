-- Interview Ready V1 (single owner). Accessed only server-side with the service-role key.
-- RLS is enabled with NO policies: the public anon/authenticated keys can read nothing.
create table if not exists documents (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('cv','jd')),
  name text, text text not null,
  created timestamptz not null default now()
);
create table if not exists claims (
  id bigint generated always as identity primary key,
  doc_id bigint references documents(id) on delete cascade,
  text text not null, type text not null,
  numbers jsonb not null default '[]', ownership text not null default 'Contributed'
);
create table if not exists sessions (
  id bigint generated always as identity primary key,
  role text default '', notes text default '',
  created timestamptz not null default now()
);
create table if not exists answers (
  id bigint generated always as identity primary key,
  session_id bigint references sessions(id) on delete cascade,
  question text, kind text, answer text,
  dims jsonb not null, fixes jsonb not null default '[]', total numeric not null,
  created timestamptz not null default now()
);
create index if not exists claims_doc_idx on claims(doc_id);
create index if not exists answers_session_idx on answers(session_id);

alter table documents enable row level security;
alter table claims enable row level security;
alter table sessions enable row level security;
alter table answers enable row level security;
