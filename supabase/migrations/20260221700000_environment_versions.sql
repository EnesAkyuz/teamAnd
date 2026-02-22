-- Add version column to environments
alter table environments add column version integer not null default 1;

-- Version history table
create table environment_versions (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references environments(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_at timestamptz default now()
);

create index idx_env_versions_env on environment_versions(environment_id, version desc);
