-- Secure, atomic manual assignment of an existing appointment.
-- Legacy anonymous booking remains unchanged until all booking clients are migrated.
create or replace function public.assign_interview_interviewer(
 p_interview_id bigint,p_interviewer_user_id uuid
) returns void
language plpgsql security definer set search_path=public
as $$
declare
 v_actor uuid:=auth.uid();
 v_shop text;
 v_date date;
 v_time time;
 v_end time;
 v_role text;
begin
 if v_actor is null then raise exception 'ログインが必要です'; end if;
 select role into v_role from public.recruit_staff_profiles where user_id=v_actor;
 if v_role not in ('master','full') then raise exception '求人管理権限がありません'; end if;
 select shop,interview_date,interview_time into v_shop,v_date,v_time
 from public.staff_interviews where id=p_interview_id for update;
 if not found then raise exception '面接予定が見つかりません'; end if;
 if not exists(select 1 from public.interview_staff_assignments a
   where a.user_id=v_actor and v_shop=any(a.stores)) then
   raise exception '担当店舗以外の面接は編集できません';
 end if;
 if not exists(select 1 from public.interview_staff_assignments a
   where a.user_id=p_interviewer_user_id and v_shop=any(a.stores)) then
   raise exception 'この店舗を担当するスタッフを選択してください';
 end if;
 v_end:=(v_time+interval '60 minutes')::time;
 if v_end<=v_time then raise exception '深夜をまたぐ面接は未対応です'; end if;
 if exists(select 1 from public.interview_staff_unavailability b
   where b.interviewer_user_id=p_interviewer_user_id and b.block_date=v_date
   and (b.all_day or (b.start_time<v_end and b.end_time>v_time))) then
   raise exception '選択した担当者は対応不可です';
 end if;
 update public.staff_interviews set interviewer_user_id=p_interviewer_user_id
 where id=p_interview_id;
end $$;
revoke all on function public.assign_interview_interviewer(bigint,uuid) from public,anon;
grant execute on function public.assign_interview_interviewer(bigint,uuid) to authenticated;
