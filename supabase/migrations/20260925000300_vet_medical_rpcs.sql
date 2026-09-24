-- Bloque D: RPC medicas (historia clinica compartida, consultas, addenda, emergencia,
-- PDF) y del propietario (historial, auditoria, banderas de emergencia).
-- Toda lectura/escritura medica exige un grant vigente y el permiso especifico,
-- comprobados EN BD en cada llamada. Las consultas son append-only.

-- ---------------------------------------------------------------------------
-- Helper: pagina de la historia de una mascota (keyset por consulted_at).
-- ---------------------------------------------------------------------------
create or replace function public._vet_history_page(
  p_pet_id uuid, p_limit integer, p_before timestamptz, p_caller_org uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_items jsonb;
  v_total integer;
  v_next timestamptz;
begin
  select coalesce(jsonb_agg(y.j order by y.rn) filter (where y.rn <= v_limit), '[]'::jsonb),
         coalesce(max(y.rn), 0),
         min(y.consulted_at) filter (where y.rn <= v_limit)
    into v_items, v_total, v_next
  from (
    select c.id, c.consulted_at,
           row_number() over (order by c.consulted_at desc, c.id desc) as rn,
           public._vet_consultation_json(c, p_caller_org) as j
    from public.vet_consultations c
    where c.pet_id = p_pet_id and (p_before is null or c.consulted_at < p_before)
    order by c.consulted_at desc, c.id desc
    limit v_limit + 1
  ) y;
  return jsonb_build_object('items', v_items, 'has_more', v_total > v_limit, 'next_before', v_next);
end;
$$;
revoke all on function public._vet_history_page(uuid, integer, timestamptz, uuid) from public, anon, authenticated;

-- Helper: mascota de usuario ACTIVA a partir del public_id de su placa (para emergencia).
create or replace function public._vet_resolve_public_tag(
  p_public_id text,
  out out_pet_id uuid,
  out out_owner_id uuid,
  out out_pet_name text,
  out out_species text,
  out out_breed text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_pet uuid;
begin
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9]{8,24}$' then
    raise exception 'PET_NOT_FOUND';
  end if;
  select t.status, t.owner_pet_id into v_status, v_pet
  from public.qr_tags t where t.public_id = lower(p_public_id);
  if not found or v_status <> 'active' or v_pet is null then
    raise exception 'PET_NOT_FOUND';
  end if;
  select p.id, p.owner_id, p.name, p.species, p.breed
    into out_pet_id, out_owner_id, out_pet_name, out_species, out_breed
  from public.pets p where p.id = v_pet and not p.is_archived;
  if out_pet_id is null then
    raise exception 'PET_NOT_FOUND';
  end if;
end;
$$;
revoke all on function public._vet_resolve_public_tag(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- VETERINARIA: resumen de la ficha (requiere can_read_medical). No trae la
-- historia; solo cabecera, antecedentes declarados y el conteo de consultas.
-- ---------------------------------------------------------------------------
create or replace function public.vet_medical_overview(p_grant_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_g record;
  v_pet jsonb;
  v_summary jsonb;
  v_items jsonb;
  v_count integer;
  v_plate text;
begin
  select * into v_g from public._vet_grant_check(p_grant_id, 'can_read_medical');

  select jsonb_build_object('name', p.name, 'species', p.species, 'species_other', p.species_other,
           'breed', p.breed, 'sex', p.sex, 'age_value', p.age_value, 'age_unit', p.age_unit,
           'status', p.status::text)
    into v_pet
  from public.pets p where p.id = v_g.out_pet_id;

  select jsonb_build_object('has_condition', s.has_condition, 'has_allergy', s.has_allergy,
           'has_medication', s.has_medication, 'has_urgent', s.has_urgent, 'notes', s.notes)
    into v_summary
  from public.pet_medical_summary s where s.owner_pet_id = v_g.out_pet_id;

  select coalesce(jsonb_agg(jsonb_build_object('kind', i.kind, 'label', i.label, 'detail', i.detail,
           'source', i.source) order by i.kind, i.created_at), '[]'::jsonb)
    into v_items
  from public.pet_medical_items i
  join public.pet_medical_summary s on s.id = i.summary_id
  where s.owner_pet_id = v_g.out_pet_id;

  select count(*) into v_count from public.vet_consultations c where c.pet_id = v_g.out_pet_id;

  select t.short_code into v_plate from public.qr_tags t
  where t.owner_pet_id = v_g.out_pet_id and t.status in ('active', 'assigned', 'suspended')
  limit 1;

  perform public._vet_audit('MEDICAL_VIEW', v_g.out_user_id, v_g.out_org_id, v_g.out_pet_id, p_grant_id,
    null, 'medical');

  return jsonb_build_object(
    'pet', v_pet, 'summary', v_summary, 'items', v_items,
    'consultation_count', v_count, 'plate_code', v_plate,
    'permissions', to_jsonb(v_g.out_perms), 'expires_at', v_g.out_expires);
end;
$$;
revoke all on function public.vet_medical_overview(uuid) from public, anon;
grant execute on function public.vet_medical_overview(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- VETERINARIA: historia clinica acumulada (de todas las organizaciones),
-- paginada. Requiere can_read_medical. Se audita la primera pagina.
-- ---------------------------------------------------------------------------
create or replace function public.vet_medical_history(
  p_grant_id uuid, p_limit integer default 10, p_before timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_g record;
begin
  select * into v_g from public._vet_grant_check(p_grant_id, 'can_read_medical');
  if p_before is null then
    perform public._vet_audit('MEDICAL_VIEW', v_g.out_user_id, v_g.out_org_id, v_g.out_pet_id, p_grant_id,
      null, 'medical');
  end if;
  return public._vet_history_page(v_g.out_pet_id, p_limit, p_before, v_g.out_org_id);
end;
$$;
revoke all on function public.vet_medical_history(uuid, integer, timestamptz) from public, anon;
grant execute on function public.vet_medical_history(uuid, integer, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- VETERINARIA: registrar una consulta. Append-only e idempotente
-- (client_request_id). Pet, organizacion y profesional salen del GRANT y de
-- auth.uid(); consulted_at lo fija el servidor. Diagnostico exige
-- can_add_diagnosis; tratamiento y medicamentos exigen can_add_treatment.
-- Consulta y medicamentos se insertan en la MISMA transaccion.
-- ---------------------------------------------------------------------------
create or replace function public.vet_consultation_create(
  p_grant_id uuid,
  p_client_request_id uuid,
  p_reason text,
  p_weight_kg numeric default null,
  p_temperature_c numeric default null,
  p_heart_rate integer default null,
  p_respiratory_rate integer default null,
  p_symptoms text default null,
  p_physical_exam text default null,
  p_diagnosis text default null,
  p_treatment text default null,
  p_recommendations text default null,
  p_final_observations text default null,
  p_urgency text default 'routine',
  p_follow_up_date date default null,
  p_medications jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller record;
  v_g record;
  v_ex_id uuid;
  v_ex_user uuid;
  v_id uuid;
  v_reason text;
  v_symptoms text;
  v_exam text;
  v_diagnosis text;
  v_treatment text;
  v_recs text;
  v_final text;
  v_urgency text := coalesce(p_urgency, 'routine');
  v_n integer := 0;
  m record;
  v_name text;
  v_dose numeric;
  v_unit text;
  v_freq text;
  v_route text;
  v_days integer;
  v_instr text;
  v_start date;
  v_end date;
  v_notes text;
begin
  select * into v_caller from public._vet_caller();
  if p_client_request_id is null then
    raise exception 'REQUEST_ID_REQUIRED';
  end if;

  -- Reintento / doble clic: si ya existe, se devuelve (sin duplicar).
  select c.id, c.vet_user_id into v_ex_id, v_ex_user
  from public.vet_consultations c where c.client_request_id = p_client_request_id;
  if found then
    if v_ex_user is distinct from v_caller.out_user_id then
      raise exception 'REQUEST_ID_IN_USE';
    end if;
    return jsonb_build_object('id', v_ex_id, 'duplicate', true);
  end if;

  select * into v_g from public._vet_grant_check(p_grant_id, 'can_create_consultation');
  perform public._vet_rate_check(v_g.out_user_id, array['MEDICAL_CREATE'], interval '1 hour', 60);

  v_reason := public._vet_clean(p_reason, 300, true);
  if char_length(v_reason) < 3 then
    raise exception 'FIELD_TOO_SHORT';
  end if;
  v_symptoms := public._vet_clean(p_symptoms, 2000);
  v_exam := public._vet_clean(p_physical_exam, 2000);
  v_diagnosis := public._vet_clean(p_diagnosis, 2000);
  v_treatment := public._vet_clean(p_treatment, 2000);
  v_recs := public._vet_clean(p_recommendations, 2000);
  v_final := public._vet_clean(p_final_observations, 2000);

  if v_urgency not in ('routine', 'urgent', 'emergency') then
    raise exception 'INVALID_VALUE';
  end if;
  if (p_weight_kg is not null and (p_weight_kg <= 0 or p_weight_kg > 500))
     or (p_temperature_c is not null and (p_temperature_c < 25 or p_temperature_c > 45))
     or (p_heart_rate is not null and (p_heart_rate < 10 or p_heart_rate > 400))
     or (p_respiratory_rate is not null and (p_respiratory_rate < 2 or p_respiratory_rate > 200))
     or (p_follow_up_date is not null and p_follow_up_date < current_date) then
    raise exception 'INVALID_VALUE';
  end if;

  if v_diagnosis is not null and not ('can_add_diagnosis' = any (v_g.out_perms)) then
    raise exception 'PERMISSION_DENIED';
  end if;
  if p_medications is not null and jsonb_typeof(p_medications) <> 'array' then
    raise exception 'INVALID_MEDICATIONS';
  end if;
  v_n := coalesce(jsonb_array_length(p_medications), 0);
  if v_n > 20 then
    raise exception 'INVALID_MEDICATIONS';
  end if;
  if (v_treatment is not null or v_n > 0) and not ('can_add_treatment' = any (v_g.out_perms)) then
    raise exception 'PERMISSION_DENIED';
  end if;

  insert into public.vet_consultations
    (client_request_id, pet_id, org_id, vet_user_id, grant_id, reason, weight_kg, temperature_c,
     heart_rate, respiratory_rate, symptoms, physical_exam, diagnosis, treatment, recommendations,
     final_observations, urgency, follow_up_date)
  values
    (p_client_request_id, v_g.out_pet_id, v_g.out_org_id, v_g.out_user_id, p_grant_id, v_reason,
     p_weight_kg, p_temperature_c, p_heart_rate, p_respiratory_rate, v_symptoms, v_exam, v_diagnosis,
     v_treatment, v_recs, v_final, v_urgency, p_follow_up_date)
  on conflict (client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- Carrera con un reintento identico: la otra transaccion ya inserto.
    select c.id into v_ex_id from public.vet_consultations c
    where c.client_request_id = p_client_request_id and c.vet_user_id = v_g.out_user_id;
    if v_ex_id is null then
      raise exception 'REQUEST_ID_IN_USE';
    end if;
    return jsonb_build_object('id', v_ex_id, 'duplicate', true);
  end if;

  for m in
    select e.value as val, e.ordinality as pos
    from jsonb_array_elements(coalesce(p_medications, '[]'::jsonb)) with ordinality as e(value, ordinality)
  loop
    if jsonb_typeof(m.val) <> 'object' then
      raise exception 'INVALID_MEDICATIONS';
    end if;
    v_name := public._vet_clean(m.val ->> 'name', 100, true);
    v_unit := public._vet_clean(m.val ->> 'dose_unit', 20);
    v_freq := public._vet_clean(m.val ->> 'frequency', 80);
    v_instr := public._vet_clean(m.val ->> 'instructions', 500);
    v_notes := public._vet_clean(m.val ->> 'notes', 300);

    v_dose := null;
    if nullif(m.val ->> 'dose', '') is not null then
      if (m.val ->> 'dose') !~ '^[0-9]{1,7}(\.[0-9]{1,3})?$' or (m.val ->> 'dose')::numeric <= 0 then
        raise exception 'INVALID_MEDICATIONS';
      end if;
      v_dose := (m.val ->> 'dose')::numeric;
      if v_unit is null then
        raise exception 'INVALID_MEDICATIONS';
      end if;
    end if;

    v_route := nullif(m.val ->> 'route', '');
    if v_route is not null and v_route not in ('oral', 'topical', 'intravenous', 'intramuscular',
         'subcutaneous', 'ophthalmic', 'otic', 'inhaled', 'rectal', 'other') then
      raise exception 'INVALID_MEDICATIONS';
    end if;

    v_days := null;
    if nullif(m.val ->> 'duration_days', '') is not null then
      if (m.val ->> 'duration_days') !~ '^[0-9]{1,3}$' or (m.val ->> 'duration_days')::integer not between 1 and 365 then
        raise exception 'INVALID_MEDICATIONS';
      end if;
      v_days := (m.val ->> 'duration_days')::integer;
    end if;

    v_start := null;
    v_end := null;
    if nullif(m.val ->> 'start_date', '') is not null then
      if (m.val ->> 'start_date') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'INVALID_MEDICATIONS';
      end if;
      v_start := (m.val ->> 'start_date')::date;
    end if;
    if nullif(m.val ->> 'end_date', '') is not null then
      if (m.val ->> 'end_date') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'INVALID_MEDICATIONS';
      end if;
      v_end := (m.val ->> 'end_date')::date;
    end if;
    if v_start is not null and v_end is not null and v_end < v_start then
      raise exception 'INVALID_MEDICATIONS';
    end if;

    insert into public.vet_consultation_medications
      (consultation_id, position, name, dose, dose_unit, frequency, route, duration_days,
       instructions, start_date, end_date, notes)
    values
      (v_id, m.pos::smallint, v_name, v_dose, v_unit, v_freq, v_route, v_days, v_instr, v_start, v_end, v_notes);
  end loop;

  perform public._vet_audit('MEDICAL_CREATE', v_g.out_user_id, v_g.out_org_id, v_g.out_pet_id, p_grant_id,
    null, 'medical');

  return jsonb_build_object('id', v_id, 'duplicate', false);
end;
$$;
revoke all on function public.vet_consultation_create(uuid, uuid, text, numeric, numeric, integer, integer,
  text, text, text, text, text, text, text, date, jsonb) from public, anon;
grant execute on function public.vet_consultation_create(uuid, uuid, text, numeric, numeric, integer, integer,
  text, text, text, text, text, text, text, date, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- VETERINARIA: addendum (correccion/aclaracion). Solo la organizacion autora
-- de la consulta puede anadirlo; el original nunca se modifica ni se borra.
-- ---------------------------------------------------------------------------
create or replace function public.vet_consultation_add_addendum(
  p_grant_id uuid, p_client_request_id uuid, p_consultation_id uuid, p_body text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller record;
  v_g record;
  v_ex_id uuid;
  v_ex_user uuid;
  v_id uuid;
  v_body text;
begin
  select * into v_caller from public._vet_caller();
  if p_client_request_id is null then
    raise exception 'REQUEST_ID_REQUIRED';
  end if;

  select a.id, a.vet_user_id into v_ex_id, v_ex_user
  from public.vet_consultation_addenda a where a.client_request_id = p_client_request_id;
  if found then
    if v_ex_user is distinct from v_caller.out_user_id then
      raise exception 'REQUEST_ID_IN_USE';
    end if;
    return jsonb_build_object('id', v_ex_id, 'duplicate', true);
  end if;

  select * into v_g from public._vet_grant_check(p_grant_id, 'can_create_consultation');

  if not exists (
    select 1 from public.vet_consultations c
    where c.id = p_consultation_id and c.pet_id = v_g.out_pet_id and c.org_id = v_g.out_org_id
  ) then
    raise exception 'PERMISSION_DENIED';
  end if;

  v_body := public._vet_clean(p_body, 2000, true);
  if char_length(v_body) < 3 then
    raise exception 'FIELD_TOO_SHORT';
  end if;

  insert into public.vet_consultation_addenda
    (client_request_id, consultation_id, org_id, vet_user_id, grant_id, body)
  values
    (p_client_request_id, p_consultation_id, v_g.out_org_id, v_g.out_user_id, p_grant_id, v_body)
  on conflict (client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    select a.id into v_ex_id from public.vet_consultation_addenda a
    where a.client_request_id = p_client_request_id and a.vet_user_id = v_g.out_user_id;
    if v_ex_id is null then
      raise exception 'REQUEST_ID_IN_USE';
    end if;
    return jsonb_build_object('id', v_ex_id, 'duplicate', true);
  end if;

  perform public._vet_audit('MEDICAL_ADDENDUM', v_g.out_user_id, v_g.out_org_id, v_g.out_pet_id, p_grant_id,
    null, 'medical');
  return jsonb_build_object('id', v_id, 'duplicate', false);
end;
$$;
revoke all on function public.vet_consultation_add_addendum(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.vet_consultation_add_addendum(uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- VETERINARIA: acceso de EMERGENCIA (nivel 2). Sin grant medico normal. Devuelve
-- SOLO los items que el propietario marco como emergency_visible. Motivo >= 10
-- caracteres, organizacion aprobada, limites de frecuencia, auditado y
-- notificado al propietario (sin datos medicos ni el motivo en la notificacion).
-- ---------------------------------------------------------------------------
create or replace function public.vet_emergency_access(
  p_tag_public_id text, p_reason text, p_method text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller record;
  v_pet record;
  v_reason text;
  v_items jsonb;
  v_n integer;
begin
  select * into v_caller from public._vet_caller();
  if p_method is null or p_method not in ('qr', 'barcode', 'manual', 'nfc') then
    raise exception 'INVALID_METHOD';
  end if;
  v_reason := public._vet_clean(p_reason, 300, true);
  if char_length(v_reason) < 10 then
    raise exception 'REASON_TOO_SHORT';
  end if;

  perform public._vet_rate_check(v_caller.out_user_id, array['EMERGENCY_ACCESS'], interval '1 hour', 3);
  perform pg_advisory_xact_lock(hashtextextended('vetem:' || v_caller.out_org_id::text, 0));

  select * into v_pet from public._vet_resolve_public_tag(p_tag_public_id);

  select count(*) into v_n from public.vet_access_audit a
  where a.actor_org_id = v_caller.out_org_id and a.action = 'EMERGENCY_ACCESS' and a.at > now() - interval '24 hours';
  if v_n >= 10 then
    raise exception 'RATE_LIMITED';
  end if;
  select count(*) into v_n from public.vet_access_audit a
  where a.actor_org_id = v_caller.out_org_id and a.pet_id = v_pet.out_pet_id
    and a.action = 'EMERGENCY_ACCESS' and a.at > now() - interval '24 hours';
  if v_n >= 3 then
    raise exception 'RATE_LIMITED';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('kind', i.kind, 'label', i.label, 'detail', i.detail)
                            order by i.kind, i.created_at), '[]'::jsonb)
    into v_items
  from public.pet_medical_items i
  join public.pet_medical_summary s on s.id = i.summary_id
  where s.owner_pet_id = v_pet.out_pet_id and i.emergency_visible;

  perform public._vet_audit('EMERGENCY_ACCESS', v_caller.out_user_id, v_caller.out_org_id, v_pet.out_pet_id,
    null, p_method, 'emergency', v_reason);
  perform public._vet_notify(v_pet.out_owner_id, 'vet_emergency_access',
    'Acceso de emergencia a la ficha de ' || left(v_pet.out_pet_name, 60),
    'La veterinaria ' || left(v_caller.out_org_name, 100) || ' consultó la información de emergencia de '
      || left(v_pet.out_pet_name, 60) || '. Puedes ver el detalle en Accesos veterinarios.');

  return jsonb_build_object(
    'pet', jsonb_build_object('name', v_pet.out_pet_name, 'species', v_pet.out_species, 'breed', v_pet.out_breed),
    'items', v_items);
end;
$$;
revoke all on function public.vet_emergency_access(text, text, text) from public, anon;
grant execute on function public.vet_emergency_access(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- VETERINARIA: autorizar la generacion del PDF (el PDF se arma en el cliente,
-- bajo demanda, con datos que ya devolvio el historial autorizado). Exige
-- can_generate_pdf + can_read_medical, limita la frecuencia y audita.
-- ---------------------------------------------------------------------------
create or replace function public.vet_pdf_authorize(p_grant_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_g record;
  v_plate text;
  v_pet_name text;
begin
  select * into v_g from public._vet_grant_check(p_grant_id, 'can_generate_pdf');
  if not ('can_read_medical' = any (v_g.out_perms)) then
    raise exception 'PERMISSION_DENIED';
  end if;
  perform public._vet_rate_check(v_g.out_user_id, array['MEDICAL_PDF'], interval '1 hour', 10);

  select p.name into v_pet_name from public.pets p where p.id = v_g.out_pet_id;
  select t.short_code into v_plate from public.qr_tags t
  where t.owner_pet_id = v_g.out_pet_id and t.status in ('active', 'assigned', 'suspended') limit 1;

  perform public._vet_audit('MEDICAL_PDF', v_g.out_user_id, v_g.out_org_id, v_g.out_pet_id, p_grant_id,
    null, 'medical');
  return jsonb_build_object('ok', true, 'pet_name', v_pet_name, 'plate_code', v_plate,
    'org_name', v_g.out_org_name, 'vet_name', v_g.out_user_name, 'generated_at', now());
end;
$$;
revoke all on function public.vet_pdf_authorize(uuid) from public, anon;
grant execute on function public.vet_pdf_authorize(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PROPIETARIO: su historia clinica, PDF, auditoria y banderas de emergencia.
-- La propiedad se comprueba contra pets.owner_id = auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.owner_medical_history(
  p_pet_id uuid, p_limit integer default 10, p_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (select 1 from public.pets p where p.id = p_pet_id and p.owner_id = v_uid) then
    raise exception 'PET_NOT_FOUND';
  end if;
  return public._vet_history_page(p_pet_id, p_limit, p_before, null);
end;
$$;
revoke all on function public.owner_medical_history(uuid, integer, timestamptz) from public, anon;
grant execute on function public.owner_medical_history(uuid, integer, timestamptz) to authenticated;

create or replace function public.owner_pdf_authorize(p_pet_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pet record;
  v_plate text;
  v_owner_name text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select p.name, p.species, p.species_other, p.breed, p.sex into v_pet
  from public.pets p where p.id = p_pet_id and p.owner_id = v_uid;
  if not found then
    raise exception 'PET_NOT_FOUND';
  end if;
  perform public._vet_rate_check(v_uid, array['MEDICAL_PDF'], interval '1 hour', 10);

  select t.short_code into v_plate from public.qr_tags t
  where t.owner_pet_id = p_pet_id and t.status in ('active', 'assigned', 'suspended') limit 1;
  select coalesce(nullif(btrim(pr.display_name), ''), 'Propietario') into v_owner_name
  from public.profiles pr where pr.id = v_uid;

  perform public._vet_audit('MEDICAL_PDF', v_uid, null, p_pet_id, null, null, 'owner');
  return jsonb_build_object('ok', true, 'pet_name', v_pet.name, 'species', v_pet.species,
    'species_other', v_pet.species_other, 'breed', v_pet.breed, 'sex', v_pet.sex,
    'plate_code', v_plate, 'owner_name', v_owner_name, 'generated_at', now());
end;
$$;
revoke all on function public.owner_pdf_authorize(uuid) from public, anon;
grant execute on function public.owner_pdf_authorize(uuid) to authenticated;

create or replace function public.owner_pet_access_audit(p_pet_id uuid, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (select 1 from public.pets p where p.id = p_pet_id and p.owner_id = v_uid) then
    raise exception 'PET_NOT_FOUND';
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.at desc)
    from (
      select a.at,
             jsonb_build_object(
               'at', a.at, 'action', a.action, 'method', a.method, 'access_level', a.access_level,
               'org_name', o.name,
               'vet_name', case when a.access_level <> 'owner'
                                then coalesce(nullif(btrim(pr.display_name), ''), 'Profesional') end,
               'emergency_reason', a.emergency_reason) as j
      from public.vet_access_audit a
      left join public.organization_profiles o on o.id = a.actor_org_id
      left join public.profiles pr on pr.id = a.actor_id
      where a.pet_id = p_pet_id and a.action <> 'IDENTIFY_FAILED'
      order by a.at desc
      limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.owner_pet_access_audit(uuid, integer) from public, anon;
grant execute on function public.owner_pet_access_audit(uuid, integer) to authenticated;

create or replace function public.owner_list_emergency_items(p_pet_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (select 1 from public.pets p where p.id = p_pet_id and p.owner_id = v_uid) then
    raise exception 'PET_NOT_FOUND';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'label', i.label, 'detail', i.detail,
             'emergency_visible', i.emergency_visible) order by i.kind, i.created_at)
    from public.pet_medical_items i
    join public.pet_medical_summary s on s.id = i.summary_id
    where s.owner_pet_id = p_pet_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.owner_list_emergency_items(uuid) from public, anon;
grant execute on function public.owner_list_emergency_items(uuid) to authenticated;

create or replace function public.owner_set_emergency_visible(p_item_id uuid, p_visible boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pet uuid;
  v_current boolean;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_visible is null then
    raise exception 'INVALID_VALUE';
  end if;
  select s.owner_pet_id, i.emergency_visible into v_pet, v_current
  from public.pet_medical_items i
  join public.pet_medical_summary s on s.id = i.summary_id
  join public.pets p on p.id = s.owner_pet_id
  where i.id = p_item_id and p.owner_id = v_uid
  for update of i;
  if v_pet is null then
    raise exception 'ITEM_NOT_FOUND';
  end if;
  if v_current is distinct from p_visible then
    update public.pet_medical_items i set emergency_visible = p_visible where i.id = p_item_id;
    perform public._vet_audit('EMERGENCY_FLAG_CHANGED', v_uid, null, v_pet, null, null, 'owner');
  end if;
  return jsonb_build_object('id', p_item_id, 'emergency_visible', p_visible);
end;
$$;
revoke all on function public.owner_set_emergency_visible(uuid, boolean) from public, anon;
grant execute on function public.owner_set_emergency_visible(uuid, boolean) to authenticated;
