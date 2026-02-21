alter table bucket_items add column alignment text check (alignment in ('favorable', 'conflicting', 'neutral'));
alter table bucket_items add column alignment_reason text;

create table user_profile (
  id uuid primary key default gen_random_uuid(),
  preferences jsonb not null default '{}',
  updated_at timestamptz default now()
);
