-- Portfolio excerpt from MOR CRM (supabase/schema/030_functions.sql — the single public write path for leads).
-- Shown for reading only.

CREATE OR REPLACE FUNCTION public.intake_submit_lead(p_ip text, p_name text, p_phone text, p_email text, p_consent boolean, p_source text, p_form_answers jsonb)
 RETURNS TABLE(out_status text, out_trip_id uuid, out_contact_id uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_recent_count int;
  v_trip_id uuid;
  v_contact_id uuid;
  v_area_id uuid;
  v_existing_phone text;
  v_existing_email text;
  v_existing_name text;
  v_existing_answers jsonb;
begin
  select count(*) into v_recent_count
  from lead_intake_attempts
  where ip = p_ip and created_at >= now() - interval '10 minutes';

  if v_recent_count >= 8 then
    insert into lead_intake_attempts (ip, outcome) values (p_ip, 'rate_limited');
    return query select 'rate_limited'::text, null::uuid, null::uuid;
    return;
  end if;

  select id into v_trip_id from trips where is_featured = true limit 1;
  if v_trip_id is null then
    insert into lead_intake_attempts (ip, outcome) values (p_ip, 'no_featured_trip');
    return query select 'no_featured_trip'::text, null::uuid, null::uuid;
    return;
  end if;

  if p_phone is not null and p_phone <> '' then
    select id, phone, email, display_name into v_contact_id, v_existing_phone, v_existing_email, v_existing_name
    from contacts where phone = p_phone or secondary_phone = p_phone limit 1;
  end if;

  if v_contact_id is null and p_email is not null and p_email <> '' then
    select id, phone, email, display_name into v_contact_id, v_existing_phone, v_existing_email, v_existing_name
    from contacts where lower(email) = lower(p_email) limit 1;
  end if;

  if v_contact_id is null then
    insert into contacts (display_name, phone, email)
    values (p_name, nullif(p_phone, ''), nullif(p_email, ''))
    returning id into v_contact_id;
  else
    update contacts set
      phone = coalesce(nullif(v_existing_phone, ''), nullif(p_phone, '')),
      email = coalesce(nullif(v_existing_email, ''), nullif(p_email, '')),
      display_name = coalesce(nullif(v_existing_name, ''), p_name)
    where id = v_contact_id;
  end if;

  select id into v_area_id from areas where name ilike '%טיסות%' limit 1;
  if v_area_id is not null then
    insert into contact_areas (contact_id, area_id) values (v_contact_id, v_area_id)
    on conflict (contact_id, area_id) do nothing;
  end if;

  select form_answers into v_existing_answers from trip_leads where contact_id = v_contact_id and trip_id = v_trip_id;

  insert into trip_leads (contact_id, trip_id, source, form_answers, submission_count)
  values (v_contact_id, v_trip_id, p_source, coalesce(v_existing_answers, '{}'::jsonb) || p_form_answers, 1)
  on conflict (contact_id, trip_id) do update
    set source = excluded.source,
        form_answers = coalesce(trip_leads.form_answers, '{}'::jsonb) || excluded.form_answers,
        submission_count = trip_leads.submission_count + 1;

  if p_consent then
    insert into marketing_consent (contact_id, subscribed, consent_source, consent_given_at, unsubscribed_at)
    values (v_contact_id, true, p_source, now(), null)
    on conflict (contact_id) do update
      set subscribed = true,
          consent_source = excluded.consent_source,
          consent_given_at = excluded.consent_given_at,
          unsubscribed_at = null;
  end if;

  insert into lead_intake_attempts (ip, outcome) values (p_ip, 'ok');

  return query select 'ok'::text, v_trip_id, v_contact_id;
end;
$function$;
