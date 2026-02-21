create table sessions (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  environment_spec jsonb,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  timestamp_ms bigint not null,
  event_type text not null,
  agent_id text,
  payload jsonb not null,
  created_at timestamptz default now()
);

create index idx_events_session on events(session_id, timestamp_ms);
