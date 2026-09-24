-- Bloque D: RPC de identificacion, solicitud/decision/revocacion de acceso.
-- Todas SECURITY DEFINER, search_path='', auth.uid() unico origen de identidad,
-- organizacion y profesional resueltos en servidor (nunca del cliente).

-- ---------------------------------------------------------------------------
-- IDENTIFICAR. Recibe el codigo tal como lo lee el QR (public_id), el codigo de
-- barras o el teclado (short_code). Solo IDENTIFICA: devuelve informacion del
-- nivel publico (la misma que ya expone el perfil publico) y el estado del
-- grant del propio llamador. Nunca datos medicos ni del propietario.
-- Codigos inexistentes, "available", de mascotas de organizacion o archivadas:
-- misma respuesta "not_found" (sin enumeracion).
-- ---------------------------------------------------------------------------
create or replace function public.vet_identify_pet(p_code text, p_method text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller record;
  v_raw text;
  v_up text;
  v_outcome text := null;
  v_found boolean := false;
  v_tag_status text;
  v_tag_public text;
  v_tag_short text;
  v_tag_pet uuid;
  v_pet_id uuid;
  v_pet jsonb;
  v_has_emergency boolean;
  v_grant public.vet_access_grants;
begin
  select * into v_caller from public._vet_caller();
  if p_method is null or p_method not in ('qr', 'barcode', 'manual', 'nfc') then
    raise exception 'INVALID_METHOD';
  end if;

  -- Limites (anti-enumeracion): total, fallos y volumen diario por profesional.
  perform public._vet_rate_check(v_caller.out_user_id, array['IDENTIFY', 'IDENTIFY_FAILED'], interval '10 minutes', 30);
  perform public._vet_rate_check(v_caller.out_user_id, array['IDENTIFY_FAILED'], interval '10 minutes', 8);
  perform public._vet_rate_check(v_caller.out_user_id, array['IDENTIFY', 'IDENTIFY_FAILED'], interval '24 hours', 300);

  v_raw := regexp_replace(coalesce(p_code, ''), '^\s+|\s+$', '', 'g');
  if v_raw = '' or char_length(v_raw) > 40 then
    v_outcome := 'invalid_code';
  else
    v_up := upper(v_raw);
    if v_up ~ '^[A-Z]{3}-[0-9]{3}$' or v_up ~ '^HV-L?[0-9]{4,6}$' then
      select t.status, t.public_id, t.short_code, t.owner_pet_id
        into v_tag_status, v_tag_public, v_tag_short, v_tag_pet
      from public.qr_tags t where t.short_code = v_up;
      v_found := found;
    elsif v_raw ~ '^[A-Za-z0-9]{8,24}$' then
      select t.status, t.public_id, t.short_code, t.owner_pet_id
        into v_tag_status, v_tag_public, v_tag_short, v_tag_pet
      from public.qr_tags t where t.public_id = lower(v_raw);
      v_found := found;
    else
      v_outcome := 'invalid_code';
    end if;
  end if;

  if v_outcome is null then
    if not v_found or v_tag_status = 'available' then
      v_outcome := 'not_found';
    elsif v_tag_status = 'assigned' then
      v_outcome := 'not_active';
    elsif v_tag_status = 'suspended' then
      v_outcome := 'suspended';
    elsif v_tag_status = 'replaced' then
      v_outcome := 'replaced';
    elsif v_tag_status = 'annulled' then
      v_outcome := 'annulled';
    elsif v_tag_pet is null then
      v_outcome := 'not_found';            -- placa de mascota de organizacion: fuera de alcance
    else
      select p.id,
             jsonb_build_object(
               'name', p.name,
               'species', p.species,
               'species_other', p.species_other,
               'breed', p.breed,
               'status', p.status::text,
               'photo_path', case when public.is_public_pet_photo(p.photo_path) then p.photo_path end,
               'medical_alert', coalesce(s.public_alert_enabled
                   and (s.has_condition or s.has_allergy or s.has_medication or s.has_urgent), false)),
             exists (select 1 from public.pet_medical_items i
                     join public.pet_medical_summary s2 on s2.id = i.summary_id
                     where s2.owner_pet_id = p.id and i.emergency_visible)
        into v_pet_id, v_pet, v_has_emergency
      from public.pets p
      left join public.pet_medical_summary s on s.owner_pet_id = p.id
      where p.id = v_tag_pet and not p.is_archived;
      if v_pet_id is null then
        v_outcome := 'not_found';
      else
        v_outcome := 'found';
      end if;
    end if;
  end if;

  if v_outcome <> 'found' then
    perform public._vet_audit('IDENTIFY_FAILED', v_caller.out_user_id, v_caller.out_org_id, null, null,
      p_method, 'identification', null,
      case when v_outcome <> 'invalid_code' then left(v_raw, 32) end);
    return jsonb_build_object('outcome', v_outcome);
  end if;

  perform public._vet_audit('IDENTIFY', v_caller.out_user_id, v_caller.out_org_id, v_pet_id, null,
    p_method, 'identification');

  select g.* into v_grant
  from public.vet_access_grants g
  where g.pet_id = v_pet_id and g.org_id = v_caller.out_org_id and g.vet_user_id = v_caller.out_user_id
    and ((g.status = 'active' and g.expires_at > now())
      or (g.status = 'pending' and g.created_at > now() - interval '7 days'))
  order by (g.status = 'active') desc, g.created_at desc
  limit 1;

  return jsonb_build_object(
    'outcome', 'found',
    'tag_public_id', v_tag_public,
    'plate_code', v_tag_short,
    'pet', v_pet,
    'has_emergency_info', v_has_emergency,
    'grant', case when v_grant.id is null then null else public._vet_grant_json(v_grant) end
  );
end;
$$;
revoke all on function public.vet_identify_pet(text, text) from public, anon;
grant execute on function public.vet_identify_pet(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- SOLICITAR ACCESO. La mascota se resuelve por el public_id de la placa (opaco,
-- no enumerable) y se revalida en servidor: placa activa, mascota de usuario no
-- archivada. El propietario, la organizacion y el profesional NUNCA vienen del
-- cliente. Idempotente: una solicitud abierta se devuelve, no se duplica.
-- ---------------------------------------------------------------------------
create or replace function public.vet_request_access(
  p_tag_public_id text,
  p_permissions text[],
  p_duration text,
  p_reason text,
  p_method text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller record;
  v_perms text[];
  v_reason text;
  v_tag_status text;
  v_tag_pet uuid;
  v_pet_name text;
  v_owner uuid;
  v_grant public.vet_access_grants;
  v_recent integer;
begin
  select * into v_caller from public._vet_caller();
  if p_method is null or p_method not in ('qr', 'barcode', 'manual', 'nfc') then
    raise exception 'INVALID_METHOD';
  end if;
  v_perms := public._vet_norm_perms(p_permissions);
  if public._vet_duration(p_duration) is null then
    raise exception 'INVALID_DURATION';
  end if;
  v_reason := public._vet_clean(p_reason, 300);

  perform public._vet_rate_check(v_caller.out_user_id, array['ACCESS_REQUEST'], interval '1 hour', 10);

  if p_tag_public_id is null or p_tag_public_id !~ '^[A-Za-z0-9]{8,24}$' then
    raise exception 'PET_NOT_FOUND';
  end if;
  select t.status, t.owner_pet_id into v_tag_status, v_tag_pet
  from public.qr_tags t where t.public_id = lower(p_tag_public_id);
  if not found or v_tag_status <> 'active' or v_tag_pet is null then
    raise exception 'PET_NOT_FOUND';
  end if;
  select p.name, p.owner_id into v_pet_name, v_owner
  from public.pets p where p.id = v_tag_pet and not p.is_archived;
  if not found then
    raise exception 'PET_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'vetreq:' || v_tag_pet::text || ':' || v_caller.out_org_id::text || ':' || v_caller.out_user_id::text, 0));

  -- Solicitudes pendientes vencidas (>7 dias) dejan de bloquear una nueva.
  update public.vet_access_grants g
     set status = 'denied', decided_at = now()
   where g.pet_id = v_tag_pet and g.org_id = v_caller.out_org_id and g.vet_user_id = v_caller.out_user_id
     and g.status = 'pending' and g.created_at <= now() - interval '7 days';

  select g.* into v_grant
  from public.vet_access_grants g
  where g.pet_id = v_tag_pet and g.org_id = v_caller.out_org_id and g.vet_user_id = v_caller.out_user_id
    and ((g.status = 'active' and g.expires_at > now()) or g.status = 'pending')
  order by (g.status = 'active') desc, g.created_at desc
  limit 1;
  if v_grant.id is not null then
    return jsonb_build_object(
      'outcome', case when v_grant.status = 'active' then 'already_active' else 'already_pending' end,
      'grant', public._vet_grant_json(v_grant));
  end if;

  select count(*) into v_recent
  from public.vet_access_grants g
  where g.pet_id = v_tag_pet and g.org_id = v_caller.out_org_id
    and g.created_at > now() - interval '24 hours';
  if v_recent >= 3 then
    raise exception 'TOO_MANY_REQUESTS';
  end if;

  begin
    insert into public.vet_access_grants
      (pet_id, owner_id, org_id, vet_user_id, requested_permissions, requested_duration, reason, identification_method)
    values
      (v_tag_pet, v_owner, v_caller.out_org_id, v_caller.out_user_id, v_perms, p_duration, v_reason, p_method)
    returning * into v_grant;
  exception when unique_violation then
    select g.* into v_grant from public.vet_access_grants g
    where g.pet_id = v_tag_pet and g.org_id = v_caller.out_org_id and g.vet_user_id = v_caller.out_user_id
      and g.status = 'pending';
    return jsonb_build_object('outcome', 'already_pending', 'grant', public._vet_grant_json(v_grant));
  end;

  perform public._vet_audit('ACCESS_REQUEST', v_caller.out_user_id, v_caller.out_org_id, v_tag_pet,
    v_grant.id, p_method, 'medical');
  perform public._vet_notify(v_owner, 'vet_access_requested',
    'Solicitud de acceso a la ficha de ' || left(v_pet_name, 60),
    'La veterinaria ' || left(v_caller.out_org_name, 100) || ' ha solicitado acceso a la ficha de '
      || left(v_pet_name, 60) || '. Revisa la solicitud para autorizarla o rechazarla.');

  return jsonb_build_object('outcome', 'created', 'grant', public._vet_grant_json(v_grant));
end;
$$;
revoke all on function public.vet_request_access(text, text[], text, text, text) from public, anon;
grant execute on function public.vet_request_access(text, text[], text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Estado de UN grant propio (sondeo de la veterinaria: autorizado / vencido /
-- revocado). Devuelve tambien los vencidos y revocados para poder informarlo.
-- ---------------------------------------------------------------------------
create or replace function public.vet_get_grant(p_grant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller record;
  v_grant public.vet_access_grants;
  v_pet_name text;
begin
  select * into v_caller from public._vet_caller();
  select g.* into v_grant from public.vet_access_grants g
  where g.id = p_grant_id and g.vet_user_id = v_caller.out_user_id and g.org_id = v_caller.out_org_id;
  if v_grant.id is null then
    raise exception 'ACCESS_DENIED';
  end if;
  select p.name into v_pet_name from public.pets p where p.id = v_grant.pet_id;
  return public._vet_grant_json(v_grant) || jsonb_build_object('pet_name', v_pet_name);
end;
$$;
revoke all on function public.vet_get_grant(uuid) from public, anon;
grant execute on function public.vet_get_grant(uuid) to authenticated;

-- Mis accesos: pendientes, vigentes y los cerrados en las ultimas 24 h.
create or replace function public.vet_my_grants()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller record;
begin
  select * into v_caller from public._vet_caller();
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc)
    from (
      select g.created_at,
             public._vet_grant_json(g) || jsonb_build_object('pet_name', p.name) as j
      from public.vet_access_grants g
      join public.pets p on p.id = g.pet_id
      where g.vet_user_id = v_caller.out_user_id and g.org_id = v_caller.out_org_id
        and (g.status in ('pending', 'active') or coalesce(g.revoked_at, g.decided_at) > now() - interval '24 hours')
      order by g.created_at desc
      limit 30
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.vet_my_grants() from public, anon;
grant execute on function public.vet_my_grants() to authenticated;

-- ---------------------------------------------------------------------------
-- PROPIETARIO: bandeja de solicitudes/accesos de SUS mascotas.
-- ---------------------------------------------------------------------------
create or replace function public.owner_list_access(p_limit integer default 50)
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
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc)
    from (
      select g.created_at,
             public._vet_grant_json(g) || jsonb_build_object(
               'pet_id', g.pet_id,
               'pet_name', p.name,
               'org_name', o.name,
               'vet_name', coalesce(nullif(btrim(pr.display_name), ''), 'Profesional')) as j
      from public.vet_access_grants g
      join public.pets p on p.id = g.pet_id
      join public.organization_profiles o on o.id = g.org_id
      join public.profiles pr on pr.id = g.vet_user_id
      where g.owner_id = v_uid
      order by g.created_at desc
      limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.owner_list_access(integer) from public, anon;
grant execute on function public.owner_list_access(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- PROPIETARIO: autorizar / rechazar. Idempotente (doble clic): solo una
-- solicitud PENDIENTE cambia de estado; las demas devuelven el estado actual
-- sin efectos. Los permisos otorgados deben ser subconjunto de los solicitados
-- y la duracion sale de una lista cerrada (expires_at lo calcula el servidor).
-- ---------------------------------------------------------------------------
create or replace function public.owner_decide_access(
  p_grant_id uuid, p_decision text, p_permissions text[], p_duration text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_grant public.vet_access_grants;
  v_perms text[];
  v_pet_name text;
  v_org_name text;
  v_label text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_decision is null or p_decision not in ('approve', 'deny') then
    raise exception 'INVALID_DECISION';
  end if;

  select g.* into v_grant from public.vet_access_grants g
  where g.id = p_grant_id and g.owner_id = v_uid
  for update;
  if v_grant.id is null then
    raise exception 'ACCESS_NOT_FOUND';
  end if;

  if v_grant.status <> 'pending' then
    return jsonb_build_object('outcome', 'already_decided', 'grant', public._vet_grant_json(v_grant));
  end if;
  if v_grant.created_at <= now() - interval '7 days' then
    raise exception 'REQUEST_EXPIRED';
  end if;

  select p.name into v_pet_name from public.pets p where p.id = v_grant.pet_id;
  select o.name into v_org_name from public.organization_profiles o where o.id = v_grant.org_id;

  if p_decision = 'approve' then
    v_perms := public._vet_norm_perms(p_permissions);
    if not (v_perms <@ v_grant.requested_permissions) then
      raise exception 'INVALID_PERMISSIONS';
    end if;
    if public._vet_duration(p_duration) is null then
      raise exception 'INVALID_DURATION';
    end if;
    update public.vet_access_grants g
       set status = 'active',
           granted_permissions = v_perms,
           granted_duration = p_duration,
           decided_at = now(),
           expires_at = now() + public._vet_duration(p_duration)
     where g.id = v_grant.id
     returning * into v_grant;
    v_label := case p_duration when '30m' then '30 minutos' when '1h' then '1 hora' else '24 horas' end;
    perform public._vet_audit('ACCESS_GRANTED', v_uid, v_grant.org_id, v_grant.pet_id, v_grant.id, null, 'owner');
    perform public._vet_notify(v_grant.vet_user_id, 'vet_access_decided',
      'Solicitud de acceso autorizada',
      'El propietario de ' || left(v_pet_name, 60) || ' autorizó el acceso a la ficha por ' || v_label || '.');
  else
    update public.vet_access_grants g
       set status = 'denied', decided_at = now()
     where g.id = v_grant.id
     returning * into v_grant;
    perform public._vet_audit('ACCESS_DENIED', v_uid, v_grant.org_id, v_grant.pet_id, v_grant.id, null, 'owner');
    perform public._vet_notify(v_grant.vet_user_id, 'vet_access_decided',
      'Solicitud de acceso rechazada',
      'El propietario de ' || left(v_pet_name, 60) || ' rechazó la solicitud de acceso a la ficha.');
  end if;

  return jsonb_build_object('outcome', 'decided', 'grant', public._vet_grant_json(v_grant));
end;
$$;
revoke all on function public.owner_decide_access(uuid, text, text[], text) from public, anon;
grant execute on function public.owner_decide_access(uuid, text, text[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- PROPIETARIO: revocar un acceso activo. Efecto inmediato: cada RPC medica
-- comprueba el estado vigente en BD. Idempotente.
-- ---------------------------------------------------------------------------
create or replace function public.owner_revoke_access(p_grant_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_grant public.vet_access_grants;
  v_pet_name text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select g.* into v_grant from public.vet_access_grants g
  where g.id = p_grant_id and g.owner_id = v_uid
  for update;
  if v_grant.id is null then
    raise exception 'ACCESS_NOT_FOUND';
  end if;

  if v_grant.status = 'revoked' then
    return jsonb_build_object('outcome', 'already_revoked', 'grant', public._vet_grant_json(v_grant));
  end if;
  if v_grant.status <> 'active' then
    raise exception 'NOT_ACTIVE';
  end if;

  update public.vet_access_grants g
     set status = 'revoked', revoked_at = now(), revoked_by = v_uid
   where g.id = v_grant.id
   returning * into v_grant;

  select p.name into v_pet_name from public.pets p where p.id = v_grant.pet_id;
  perform public._vet_audit('ACCESS_REVOKED', v_uid, v_grant.org_id, v_grant.pet_id, v_grant.id, null, 'owner');
  perform public._vet_notify(v_grant.vet_user_id, 'vet_access_revoked',
    'Acceso a la ficha revocado',
    'El propietario de ' || left(v_pet_name, 60) || ' revocó el acceso a la ficha.');

  return jsonb_build_object('outcome', 'revoked', 'grant', public._vet_grant_json(v_grant));
end;
$$;
revoke all on function public.owner_revoke_access(uuid) from public, anon;
grant execute on function public.owner_revoke_access(uuid) to authenticated;
