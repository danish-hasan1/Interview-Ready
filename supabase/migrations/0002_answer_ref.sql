-- Link each answer to the CV claim or JD requirement it tested (drives the defence board).
alter table answers add column if not exists ref text not null default '';
create index if not exists answers_ref_idx on answers(ref);
