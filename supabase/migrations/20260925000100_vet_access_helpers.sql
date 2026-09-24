-- Bloque D: helpers internos. NO son invocables por anon ni authenticated; solo
-- las RPC SECURITY DEFINER de las migraciones siguientes los usan.
--
-- Nota PL/pgSQL: los parametros OUT/RETURNS TABLE se vuelven variables y chocan con
-- columnas homonimas (error 42702). Por eso los OUT llevan prefijo out_ y las RPC
-- publicas devuelven jsonb.

-- ---------------------------------------------------------------------------
-- Quien llama: usuario autenticado con rol veterinaria y organizacion aprobada
-- y activa. UNICO lugar que traduce "usuario -> organizacion": si mas adelante
-- una organizacion tiene varios profesionales, solo cambia esta funcion.
-- ---------------------------------------------------------------------------
create or replace function public._vet_caller(
  out out_user_id uuid,
  out out_org_id uuid,
  out out_org_name text,
  out out_user_name text
)
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

  select op.id, op.name into out_org_id, out_org_name
  from public.profiles pr
  join public.organization_profiles op on op.owner_id = pr.id
  where pr.id = v_uid
    and pr.role = 'veterinaria'
    and op.kind = 'veterinaria'
    and op.approval_status = 'approved'
    and op.is_active;

  if out_org_id is null then
    raise exception 'VET_NOT_AUTHORIZED';
  end if;

  out_user_id := v_uid;
  select coalesce(nullif(btrim(p2.display_name), ''), 'Profesional') into out_user_name
  from public.profiles p2 where p2.id = v_uid;
end;
$$;
revoke all on function public._vet_caller() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Limpieza de texto libre: quita caracteres de control, recorta, valida longitud.
-- ---------------------------------------------------------------------------
create or replace function public._vet_clean(p_text text, p_max integer, p_required boolean default false)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  v := regexp_replace(coalesce(p_text, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
  v := regexp_replace(v, '^\s+|\s+$', '', 'g');
  if v = '' then
    if p_required then
      raise exception 'FIELD_REQUIRED';
    end if;
    return null;
  end if;
  if char_length(v) > p_max then
    raise exception 'FIELD_TOO_LONG';
  end if;
  return v;
end;
$$;
revoke all on function public._vet_clean(text, integer, boolean) from public, anon, authenticated;

-- Duracion elegida (nunca un expires_at libre del cliente).
create or replace function public._vet_duration(p_duration text)
returns interval
language plpgsql
immutable
set search_path = ''
as $$
begin
  return case p_duration
    when '30m' then interval '30 minutes'
    when '1h' then interval '1 hour'
    when '24h' then interval '24 hours'
    else null
  end;
end;
$$;
revoke all on function public._vet_duration(text) from public, anon, authenticated;

-- Permisos explicitos: solo los cinco conocidos, sin repetidos, al menos uno.
create or replace function public._vet_norm_perms(p_perms text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text[];
begin
  if p_perms is null or cardinality(p_perms) = 0 then
    raise exception 'INVALID_PERMISSIONS';
  end if;
  select array_agg(distinct x order by x) into v from unnest(p_perms) as x;
  if not (v <@ array['can_read_medical', 'can_create_consultation', 'can_add_diagnosis',
                     'can_add_treatment', 'can_generate_pdf']::text[]) then
    raise exception 'INVALID_PERMISSIONS';
  end if;
  return v;
end;
$$;
revoke all on function public._vet_norm_perms(text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rate limiting con PostgreSQL. El advisory lock por actor serializa las
-- comprobaciones concurrentes del mismo usuario (sin el, dos llamadas
-- simultaneas podrian pasar ambas justo bajo el limite).
-- ---------------------------------------------------------------------------
create or replace function public._vet_rate_check(
  p_actor uuid, p_actions text[], p_window interval, p_max integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('vetrl:' || p_actor::text, 0));
  select count(*) into v_n
  from public.vet_access_audit a
  where a.actor_id = p_actor and a.action = any (p_actions) and a.at > now() - p_window;
  if v_n >= p_max then
    raise exception 'RATE_LIMITED';
  end if;
end;
$$;
revoke all on function public._vet_rate_check(uuid, text[], interval, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auditoria (append-only). Nunca recibe contenido medico.
-- ---------------------------------------------------------------------------
create or replace function public._vet_audit(
  p_action text, p_actor uuid, p_org uuid, p_pet uuid, p_grant uuid,
  p_method text, p_level text, p_reason text default null, p_hint text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.vet_access_audit
    (action, actor_id, actor_org_id, pet_id, grant_id, method, access_level, emergency_reason, code_hint)
  values (p_action, p_actor, p_org, p_pet, p_grant, p_method, p_level, p_reason, p_hint);
end;
$$;
revoke all on function public._vet_audit(text, uuid, uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- Notificacion (tabla notifications existente). Sin datos medicos en el texto.
create or replace function public._vet_notify(p_user uuid, p_type text, p_title text, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, title, body)
  values (p_user, p_type, left(p_title, 160), left(p_body, 400));
end;
$$;
revoke all on function public._vet_notify(uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Estado efectivo: "expired" se DERIVA, no se guarda.
-- ---------------------------------------------------------------------------
create or replace function public._vet_effective_status(p_status text, p_expires timestamptz, p_created timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_status = 'active' and p_expires <= now() then 'expired'
    when p_status = 'pending' and p_created <= now() - interval '7 days' then 'expired'
    else p_status
  end;
$$;
revoke all on function public._vet_effective_status(text, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public._vet_grant_json(g public.vet_access_grants)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'status', g.status,
    'effective_status', public._vet_effective_status(g.status, g.expires_at, g.created_at),
    'requested_permissions', g.requested_permissions,
    'granted_permissions', g.granted_permissions,
    'requested_duration', g.requested_duration,
    'granted_duration', g.granted_duration,
    'reason', g.reason,
    'created_at', g.created_at,
    'decided_at', g.decided_at,
    'expires_at', g.expires_at,
    'revoked_at', g.revoked_at
  );
$$;
revoke all on function public._vet_grant_json(public.vet_access_grants) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Comprobacion de un grant para una operacion sensible. SIEMPRE consulta la BD
-- (nada de tokens locales): profesional y organizacion del grant deben ser los
-- del llamador, estado activo, no vencido, permiso especifico y mascota no
-- archivada. Todas las fallas dan el mismo error generico (no revela por que).
-- FOR SHARE: una revocacion concurrente espera a que termine la operacion en
-- curso o la operacion ve la revocacion; nunca queda a medias.
-- ---------------------------------------------------------------------------
create or replace function public._vet_grant_check(
  p_grant_id uuid,
  p_perm text,
  out out_pet_id uuid,
  out out_owner_id uuid,
  out out_org_id uuid,
  out out_org_name text,
  out out_user_id uuid,
  out out_user_name text,
  out out_perms text[],
  out out_expires timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller record;
begin
  select * into v_caller from public._vet_caller();

  select g.pet_id, g.owner_id, g.granted_permissions, g.expires_at
    into out_pet_id, out_owner_id, out_perms, out_expires
  from public.vet_access_grants g
  where g.id = p_grant_id
    and g.vet_user_id = v_caller.out_user_id
    and g.org_id = v_caller.out_org_id
    and g.status = 'active'
    and g.expires_at > now()
  for share of g;

  if out_pet_id is null then
    raise exception 'ACCESS_DENIED';
  end if;
  if p_perm is not null and not (p_perm = any (out_perms)) then
    raise exception 'PERMISSION_DENIED';
  end if;
  if not exists (select 1 from public.pets p where p.id = out_pet_id and not p.is_archived) then
    raise exception 'ACCESS_DENIED';
  end if;

  out_org_id := v_caller.out_org_id;
  out_org_name := v_caller.out_org_name;
  out_user_id := v_caller.out_user_id;
  out_user_name := v_caller.out_user_name;
end;
$$;
revoke all on function public._vet_grant_check(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- JSON de una consulta (con medicamentos y addenda) para lectura autorizada.
-- ---------------------------------------------------------------------------
create or replace function public._vet_consultation_json(c public.vet_consultations, p_caller_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'consulted_at', c.consulted_at,
    'org_name', (select o.name from public.organization_profiles o where o.id = c.org_id),
    'vet_name', (select coalesce(nullif(btrim(pr.display_name), ''), 'Profesional')
                 from public.profiles pr where pr.id = c.vet_user_id),
    'own_org', (p_caller_org is not null and c.org_id = p_caller_org),
    'reason', c.reason,
    'weight_kg', c.weight_kg,
    'temperature_c', c.temperature_c,
    'heart_rate', c.heart_rate,
    'respiratory_rate', c.respiratory_rate,
    'symptoms', c.symptoms,
    'physical_exam', c.physical_exam,
    'diagnosis', c.diagnosis,
    'treatment', c.treatment,
    'recommendations', c.recommendations,
    'final_observations', c.final_observations,
    'urgency', c.urgency,
    'follow_up_date', c.follow_up_date,
    'medications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', m.name, 'dose', m.dose, 'dose_unit', m.dose_unit, 'frequency', m.frequency,
        'route', m.route, 'duration_days', m.duration_days, 'instructions', m.instructions,
        'start_date', m.start_date, 'end_date', m.end_date, 'notes', m.notes
      ) order by m.position)
      from public.vet_consultation_medications m where m.consultation_id = c.id
    ), '[]'::jsonb),
    'addenda', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'created_at', a.created_at, 'body', a.body,
        'org_name', (select o2.name from public.organization_profiles o2 where o2.id = a.org_id),
        'vet_name', (select coalesce(nullif(btrim(pr2.display_name), ''), 'Profesional')
                     from public.profiles pr2 where pr2.id = a.vet_user_id)
      ) order by a.created_at)
      from public.vet_consultation_addenda a where a.consultation_id = c.id
    ), '[]'::jsonb)
  );
$$;
revoke all on function public._vet_consultation_json(public.vet_consultations, uuid) from public, anon, authenticated;
