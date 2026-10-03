-- Pre-interview training progress (single owner, service-role access only).
create table if not exists training (
  id bigint generated always as identity primary key,
  lesson_id text not null,
  score numeric not null default 0,
  created timestamptz not null default now()
);
alter table training enable row level security;
