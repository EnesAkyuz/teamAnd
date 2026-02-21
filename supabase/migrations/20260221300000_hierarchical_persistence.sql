-- Environments: top-level workspace
create table environments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Configs: team designs within an environment
create table configs (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid references environments(id) on delete cascade,
  name text not null,
  spec jsonb not null,
  created_at timestamptz default now()
);

-- Runs: executions of a config
create table runs (
  id uuid primary key default gen_random_uuid(),
  config_id uuid references configs(id) on delete cascade,
  prompt text,
  status text not null default 'running' check (status in ('running', 'complete', 'stopped')),
  created_at timestamptz default now()
);

-- Scope bucket_items to environments
alter table bucket_items add column environment_id uuid references environments(id) on delete cascade;

-- Events can reference runs
alter table events add column run_id uuid references runs(id) on delete cascade;

create index idx_configs_env on configs(environment_id);
create index idx_runs_config on runs(config_id, created_at desc);
create index idx_events_run on events(run_id, timestamp_ms);
create index idx_bucket_env on bucket_items(environment_id);
