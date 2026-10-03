-- Interview targets (specific interviews + the built-in General target) and prepared answers.
create table if not exists targets (
  id bigint generated always as identity primary key,
  kind text not null default 'interview' check (kind in ('general','interview')),
  company text not null default '', role text not null default '',
  stage text not null default 'hiring_manager',
  interview_date date, jd_text text not null default '', interviewer_notes text not null default '',
  research jsonb not null default '{}',
  created timestamptz not null default now(), updated timestamptz not null default now()
);
create table if not exists prepared_answers (
  id bigint generated always as identity primary key,
  target_id bigint not null references targets(id) on delete cascade,
  question_id text not null, text text not null default '', score numeric not null default 0,
  updated timestamptz not null default now(),
  unique (target_id, question_id)
);
alter table targets enable row level security;
alter table prepared_answers enable row level security;
