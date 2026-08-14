-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
-- Adds a private file storage bucket for candidate CVs (original + formatted).
-- This is separate from the crm_kv table set up in schema.sql.

insert into storage.buckets (id, name, public)
values ('candidate-cvs', 'candidate-cvs', false)
on conflict (id) do nothing;

-- Files are stored under a path like "<user_id>/<candidate_id>/<filename>" —
-- these policies restrict every operation to files under your own user_id folder,
-- the same privacy model as the crm_kv table.
create policy "Users manage their own CV files (select)"
  on storage.objects for select
  using (bucket_id = 'candidate-cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users manage their own CV files (insert)"
  on storage.objects for insert
  with check (bucket_id = 'candidate-cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users manage their own CV files (update)"
  on storage.objects for update
  using (bucket_id = 'candidate-cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users manage their own CV files (delete)"
  on storage.objects for delete
  using (bucket_id = 'candidate-cvs' and (storage.foldername(name))[1] = auth.uid()::text);
