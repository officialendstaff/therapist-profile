-- Guard manually assigned interviewer on booking writes.
-- Legacy appointments with NULL interviewer remain unchanged until booking UI is migrated.
create or replace function public.validate_interview_manual_assignment()
returns trigger language plpgsql security definer set search_path=public
as $$
declare
 v_start time;
 v_end time;
begin
 if tg_op='UPDATE' and
    new.interviewer_user_id is not distinct from old.interviewer_user_id and
    new.shop is not distinct from old.shop and
    new.interview_date is not distinct from old.interview_date and
    new.interview_time is not distinct from old.interview_time then
   return new;
 end if;
 if new.interviewer_user_id is null then return new; end if;
 if new.interview_date is null or new.interview_time is null or new.shop is null then
   raise exception '面接担当者を指定する場合は店舗・日時が必要です';
 end if;
 if not exists(
   select 1 from public.interview_staff_assignments a
   where a.user_id=new.interviewer_user_id and new.shop=any(a.stores)
 ) then raise exception '選択した担当者はこの店舗を担当していません'; end if;
 v_start:=new.interview_time;
 v_end:=(new.interview_time+interval '60 minutes')::time;
 if v_end<=v_start then raise exception '深夜をまたぐ予約時間は未対応です'; end if;
 if exists(
  select 1 from public.interview_staff_unavailability b
  where b.interviewer_user_id=new.interviewer_user_id
    and b.block_date=new.interview_date
    and (b.all_day or (b.start_time<v_end and b.end_time>v_start))
 ) then raise exception '選択した担当者は指定時間に対応できません'; end if;
 return new;
end $$;
drop trigger if exists staff_interviews_validate_manual_assignment on public.staff_interviews;
create trigger staff_interviews_validate_manual_assignment
before insert or update of interviewer_user_id,shop,interview_date,interview_time
on public.staff_interviews
for each row execute function public.validate_interview_manual_assignment();
-- The existing public INSERT policy remains permissive. Making interviewer mandatory
-- requires migrating ALL booking clients first; do not enforce NOT NULL here.
