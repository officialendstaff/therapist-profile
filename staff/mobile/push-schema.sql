-- Interview Web Push: phase 1 database schema
-- Execute in the EXISTING Supabase project SQL Editor, after review.
-- No triggers or delivery jobs are enabled by this migration.
begin;

create table if not exists public.staff_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_push_endpoint_nonempty check (length(endpoint) > 20),
  constraint staff_push_subscription_shape check (
    subscription ? 'endpoint'
    and subscription ? 'keys'
    and subscription->>'endpoint' = endpoint
  )
);
create index if not exists staff_push_subscriptions_user_idx
  on public.staff_push_subscriptions(user_id);
alter table public.staff_push_subscriptions enable row level security;

drop policy if exists "push_owner_select" on public.staff_push_subscriptions;
create policy "push_owner_select" on public.staff_push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "push_owner_insert" on public.staff_push_subscriptions;
create policy "push_owner_insert" on public.staff_push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "push_owner_update" on public.staff_push_subscriptions;
create policy "push_owner_update" on public.staff_push_subscriptions
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "push_owner_delete" on public.staff_push_subscriptions;
create policy "push_owner_delete" on public.staff_push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Delivery events are server-managed; no authenticated/anon policies.
create table if not exists public.staff_push_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'interview_new','interview_cancel','interview_reschedule',
    'interview_form','interview_help'
  )),
  source_table text not null check (source_table in ('staff_interviews','interview_applicants')),
  source_id text not null,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index if not exists staff_push_events_pending_idx
  on public.staff_push_events(created_at) where delivered_at is null;
alter table public.staff_push_events enable row level security;
revoke all on public.staff_push_events from anon, authenticated;

commit;
