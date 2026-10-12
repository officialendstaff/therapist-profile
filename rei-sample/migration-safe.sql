-- Safer replacement for migration-draft.sql; do not run the older draft.
-- Review current database policies and choose the correct project before execution.
create table if not exists public.therapist_sample_pages (
 therapist_key text primary key,
 owner_uid uuid not null references auth.users(id),
 config jsonb not null default '{}'::jsonb,
 published boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.therapist_sample_pages enable row level security;
create policy "Published therapist sample read"
 on public.therapist_sample_pages for select to anon
 using (published = true);
create policy "Therapist owner read"
 on public.therapist_sample_pages for select to authenticated
 using (owner_uid = (select auth.uid()));
create policy "Therapist owner update"
 on public.therapist_sample_pages for update to authenticated
 using (owner_uid = (select auth.uid()))
 with check (owner_uid = (select auth.uid()));
-- No client INSERT or DELETE policy. Admin provisions owner_uid.
-- Before execution, check whether these policies already exist: repeated CREATE POLICY fails.
-- Never run this file against an unverified Supabase project.
