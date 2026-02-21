create table bucket_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('rule', 'skill', 'value', 'tool')),
  label text not null,
  created_at timestamptz default now()
);

create index idx_bucket_items_category on bucket_items(category);
