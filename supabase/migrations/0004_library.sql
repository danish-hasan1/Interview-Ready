-- Reviewed coach notes and question presets ("outputs become presets"). Single owner, service-role only.
create table if not exists library (
  id bigint generated always as identity primary key,
  kind text not null default 'feedback',
  question text not null,
  text text not null,
  approved boolean not null default false,
  created timestamptz not null default now()
);
create index if not exists library_question_idx on library(question) where approved;
alter table library enable row level security;
