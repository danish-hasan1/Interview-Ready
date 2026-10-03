-- Story bank and real-interview debriefs (single owner, service-role access only).
create table if not exists stories (
  id bigint generated always as identity primary key,
  theme text not null, title text not null default '',
  fields jsonb not null default '{}', composed text not null default '', score numeric not null default 0,
  created timestamptz not null default now(), updated timestamptz not null default now()
);
create table if not exists debriefs (
  id bigint generated always as identity primary key,
  company text not null default '', role text not null default '',
  interview_date date, outcome text not null default 'pending' check (outcome in ('pending','offer','rejected','withdrawn')),
  notes text not null default '', questions jsonb not null default '[]',
  created timestamptz not null default now()
);
alter table stories enable row level security;
alter table debriefs enable row level security;
