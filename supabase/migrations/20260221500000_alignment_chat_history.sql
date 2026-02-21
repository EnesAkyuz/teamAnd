create table alignment_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  thinking text,
  tool_calls jsonb,
  created_at timestamptz default now()
);

create index idx_alignment_messages_created on alignment_messages(created_at);
