-- Phase 2: enqueue five interview events, without sending or enabling paid services.
-- Apply only after push sender is deployed and tested.
begin;
create or replace function public.queue_staff_interview_push()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  kind text;
  detail jsonb;
begin
  if TG_TABLE_NAME = 'staff_interviews' then
    if TG_OP = 'INSERT' then
      if NEW.status IS DISTINCT FROM '面接予定' then return NEW; end if;
      kind := 'interview_new';
    elsif NEW.status IN ('キャンセル', 'トビ（キャンセル）')
      and OLD.status IS DISTINCT FROM NEW.status then
      kind := 'interview_cancel';
    elsif NEW.status = '面接予定' AND
      (NEW.interview_date is distinct from OLD.interview_date
       or NEW.interview_time is distinct from OLD.interview_time) then
      kind := 'interview_reschedule';
    else
      return NEW;
    end if;
    detail := jsonb_build_object('shop', NEW.shop, 'date', NEW.interview_date, 'time', NEW.interview_time);
  elsif TG_TABLE_NAME = 'interview_applicants' then
    if TG_OP <> 'INSERT' then return NEW; end if;
    if NEW.remarks = 'HELP' then kind := 'interview_help';
    else kind := 'interview_form'; end if;
    -- Do not put applicants' names, phone numbers or identity documents in push messages.
    detail := jsonb_build_object('shop', NEW.shop);
  else
    return NEW;
  end if;
  insert into public.staff_push_events (event_type,source_table,source_id,payload)
  values (kind,TG_TABLE_NAME,NEW.id::text,detail);
  return NEW;
end;
$$;
revoke all on function public.queue_staff_interview_push() from public, anon, authenticated;
drop trigger if exists staff_interview_push_enqueue on public.staff_interviews;
create trigger staff_interview_push_enqueue
after insert or update on public.staff_interviews
for each row execute function public.queue_staff_interview_push();
drop trigger if exists staff_form_push_enqueue on public.interview_applicants;
create trigger staff_form_push_enqueue
after insert on public.interview_applicants
for each row execute function public.queue_staff_interview_push();
commit;
