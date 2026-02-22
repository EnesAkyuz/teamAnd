create table shared_packages (
  id uuid primary key default gen_random_uuid(),
  share_code text unique not null,
  creator_name text not null default 'Anonymous',
  environment_name text not null,
  description text,
  package_data jsonb not null,
  created_at timestamptz default now()
);

create index idx_shared_packages_code on shared_packages(share_code);
