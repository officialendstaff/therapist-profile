-- Read-only helper for appointment booking to see which interviewers are available.
-- The returned rows are scoped to the requested store and date, not to URL parameters.
create or replace function public.interview_available_staff(
 p_shop text,p_date date,p_start time,p_end time
) returns table(interviewer_user_id uuid,display_name text,profile_key text)
language sql stable security invoker set search_path=public
as $$
 select a.user_id,a.display_name,a.profile_key
 from public.interview_staff_assignments a
 where p_shop=any(a.stores)
 and p_date>=current_date
 and p_start<p_end
 and not exists (
  select 1 from public.interview_staff_unavailability b
  where b.interviewer_user_id=a.user_id and b.block_date=p_date
   and (b.all_day or (b.start_time<p_end and b.end_time>p_start))
 )
 order by a.profile_key
$$;
grant execute on function public.interview_available_staff(text,date,time,time) to anon,authenticated;
