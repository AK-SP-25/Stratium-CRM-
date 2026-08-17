-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
-- Only needed if you're moving from a single private login to a shared team
-- workspace (multiple consultants, everyone sees everyone's data). If you're
-- staying solo, you don't need this file.

-- Replace the "only your own rows" policy with "any signed-in account you've
-- created can read and write everything". Every login is still one you
-- create yourself in Authentication -> Users, so "signed in" already means
-- "someone I've trusted with access" — there's no public sign-up.
drop policy if exists "Users manage their own CRM data" on crm_kv;

create policy "Team members share all CRM data"
  on crm_kv
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Same idea for candidate CV files — any signed-in team member can access
-- any file, not just ones they personally uploaded.
drop policy if exists "Users manage their own CV files (select)" on storage.objects;
drop policy if exists "Users manage their own CV files (insert)" on storage.objects;
drop policy if exists "Users manage their own CV files (update)" on storage.objects;
drop policy if exists "Users manage their own CV files (delete)" on storage.objects;

create policy "Team members share all CV files"
  on storage.objects
  for all
  using (bucket_id = 'candidate-cvs' and auth.uid() is not null)
  with check (bucket_id = 'candidate-cvs' and auth.uid() is not null);
