-- Identificacion veterinaria SOLO por QR / NFC.
--
-- Decision de producto: la placa fisica tiene QR (y NFC a futuro); NO tiene codigo de
-- barras y el short_code NO es un metodo de identificacion veterinaria (sigue existiendo
-- para administracion, inventario, proveedor y pedidos).
--
-- Cambios (todo del lado del servidor):
--  1. vet_access_grants.identification_method y vet_access_audit.method: solo ('qr','nfc').
--     Las dos tablas estaban vacias al aplicar (sin datos que migrar).
--  2. vet_identify_pet: ya no resuelve short_code (responde invalid_code); solo public_id
--     (el token opaco del QR/NFC). Metodos validos: qr, nfc.
--  3. vet_request_access y vet_emergency_access: metodos validos qr, nfc.
-- Autorizacion sin cambios: usuario autenticado + organizacion veterinaria aprobada
-- (_vet_caller) + grant vigente + auditoria + limites de frecuencia.

do $chk$
begin
  if exists (select 1 from public.vet_access_grants where identification_method not in ('qr','nfc'))
     or exists (select 1 from public.vet_access_audit where method is not null and method not in ('qr','nfc')) then
    raise exception 'Existen filas con metodos de identificacion retirados; revisar antes de aplicar.';
  end if;
end
$chk$;

alter table public.vet_access_grants drop constraint if exists vet_access_grants_identification_method_check;
alter table public.vet_access_grants add constraint vet_access_grants_identification_method_check
  check (identification_method in ('qr', 'nfc'));

alter table public.vet_access_audit drop constraint if exists vet_access_audit_method_check;
alter table public.vet_access_audit add constraint vet_access_audit_method_check
  check (method is null or method in ('qr', 'nfc'));


-- vet_request_access
CREATE OR REPLACE FUNCTION public.vet_request_access(p_tag_public_id text, p_permissions text[], p_duration text, p_reason text, p_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if p_method is null or p_method not in ('qr', 'nfc') then
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
$function$;


-- vet_emergency_access
CREATE OR REPLACE FUNCTION public.vet_emergency_access(p_tag_public_id text, p_reason text, p_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_caller record;
  v_pet record;
  v_reason text;
  v_items jsonb;
  v_n integer;
begin
  select * into v_caller from public._vet_caller();
  if p_method is null or p_method not in ('qr', 'nfc') then
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
$function$;


-- vet_identify_pet
CREATE OR REPLACE FUNCTION public.vet_identify_pet(p_code text, p_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if p_method is null or p_method not in ('qr', 'nfc') then
    raise exception 'INVALID_METHOD';
  end if;

  perform public._vet_rate_check(v_caller.out_user_id, array['IDENTIFY', 'IDENTIFY_FAILED'], interval '10 minutes', 30);
  perform public._vet_rate_check(v_caller.out_user_id, array['IDENTIFY_FAILED'], interval '10 minutes', 8);
  perform public._vet_rate_check(v_caller.out_user_id, array['IDENTIFY', 'IDENTIFY_FAILED'], interval '24 hours', 300);

  v_raw := regexp_replace(coalesce(p_code, ''), '^\s+|\s+$', '', 'g');
  if v_raw = '' or char_length(v_raw) > 40 then
    v_outcome := 'invalid_code';
  else
    v_up := upper(v_raw);
    if v_up ~ '^[A-Z]{3}-[0-9]{3}$' or v_up ~ '^HV-L?[0-9]{4,6}$' then
      -- El short_code es un identificador administrativo: NO identifica para veterinaria.
      v_outcome := 'invalid_code';
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
      v_outcome := 'not_found';
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
$function$;
