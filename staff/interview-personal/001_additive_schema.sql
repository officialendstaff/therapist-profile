-- Stage 1: additive, backwards-compatible schema. Apply only after reviewing existing 14 blocks.
-- Existing public policies are NOT changed in this migration; production is not secure until stage 2.
create table if not exists public.interview_staff_assignments (
 user_id uuid primary key references auth.users(id) on delete cascade,
 profile_key text not null unique check (profile_key in ('owner','president','ota')),
 display_name text not null,
 stores text[] not null,
 created_at timestamptz not null default now()
);
alter table public.interview_staff_assignments enable row level security;
create policy "interview assignments self read" on public.interview_staff_assignments
 for select to authenticated using (user_id=auth.uid());
-- The three confirmed accounts (do not change existing recruitment permissions).
insert into public.interview_staff_assignments(user_id,profile_key,display_name,stores) values
 ('72ad8e71-100a-4cb4-8a63-813154b62f99','owner','俺',array['薔薇と紳士','BUSTY OSAKA']),
 ('9bcf0e46-f443-4c8b-8f43-2d99f0cabbc6','president','社長',array['Grand Luxe','Un Secret','LUXY']),
 ('745f4373-dc35-4cf3-ab06-577d54d6694e','ota','おおたくん',array['Grand Luxe','Un Secret','LUXY'])
on conflict (user_id) do update set profile_key=excluded.profile_key,display_name=excluded.display_name,stores=excluded.stores;
alter table public.staff_interviews add column if not exists interviewer_user_id uuid references auth.users(id);
alter table public.staff_schedule_blocks add column if not exists interviewer_user_id uuid references auth.users(id);
create index if not exists staff_interviews_interviewer_date_idx on public.staff_interviews(interviewer_user_id,interview_date);
create index if not exists staff_schedule_blocks_interviewer_date_idx on public.staff_schedule_blocks(interviewer_user_id,block_date);
-- Do not assign historic NULL interviewer IDs automatically.
-- Stage 2 must replace permissive RLS, refactor booking availability, and verify push routing.
