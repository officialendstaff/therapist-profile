-- Rei sample migration: additive schema only. NOT applied automatically.
-- Execute only after verifying project, owner UID, existing policies and backups.
create table if not exists public.therapist_sample_pages (
  therapist_key text primary key,
  owner_uid uuid not null references auth.users(id),
  config jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint therapist_sample_pages_key_check check (therapist_key ~ '^[a-z0-9_-]+$')
);
alter table public.therapist_sample_pages enable row level security;
-- Public may read published therapist configurations only if published=true.
-- Restrict draft data (including personal contact details) from anonymous access.
create policy "Public read published therapist pages"
on public.therapist_sample_pages for select to anon
using (published = true);
create policy "Owners read their pages"
on public.therapist_sample_pages for select to authenticated
using (owner_uid = (select auth.uid()));
-- WARNING: Do not apply the INSERT policy below until ownership provisioning is redesigned.
create policy "Owners insert their pages"
on public.therapist_sample_pages for insert to authenticated
with check (owner_uid = (select auth.uid()));
create policy "Owners update their pages"
on public.therapist_sample_pages for update to authenticated
using (owner_uid = (select auth.uid()))
with check (owner_uid = (select auth.uid()));
-- Do not create a public write policy.
-- Owner account assignment and storage policies must be configured separately.
-- Do not copy production rows into this table until mapping has been verified.
