-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

create table if not exists crm_kv (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table crm_kv enable row level security;

-- Each signed-in user can only ever read or write their own rows.
create policy "Users manage their own CRM data"
  on crm_kv
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
