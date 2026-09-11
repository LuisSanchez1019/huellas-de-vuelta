-- §11: una veterinaria/fundacion que YA recibio la mascota del titular puede
-- consultar sus datos de contacto SOLO si el titular activo allow_org_contact_access.
create or replace function public.org_pet_owner_contact(p_event_id uuid)
returns table (owner_name text, owner_phone text, owner_phone_alt text, owner_email text, authorized boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org_id uuid;
  v_owner uuid;
  v_received timestamptz;
  v_allowed boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select e.selected_org_id, e.owner_id, e.org_received_at
    into v_org_id, v_owner, v_received
  from public.pet_report_events e
  where e.id = p_event_id;
  if not found or v_org_id is null then
    raise exception 'Aviso no encontrado.';
  end if;

  -- El llamador debe ser la organizacion seleccionada en ese aviso.
  if not exists (
    select 1 from public.organization_profiles o
    where o.id = v_org_id and o.owner_id = v_uid
  ) then
    raise exception 'No autorizado.';
  end if;

  -- Solo tras confirmar la recepcion (finalidad: coordinar la entrega).
  if v_received is null then
    raise exception 'Confirma primero la recepcion de la mascota.';
  end if;

  select coalesce(pp.allow_org_contact_access, false)
    into v_allowed
  from public.user_privacy_preferences pp where pp.user_id = v_owner;
  v_allowed := coalesce(v_allowed, false);

  if not v_allowed then
    return query select null::text, null::text, null::text, null::text, false;
    return;
  end if;

  return query
  select nullif(btrim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''),
         nullif(btrim(coalesce(pr.phone, '')), ''),
         nullif(btrim(coalesce(pr.phone_alt, '')), ''),
         u.email::text,
         true
  from public.profiles pr
  left join auth.users u on u.id = pr.id
  where pr.id = v_owner;
end;
$$;
revoke all on function public.org_pet_owner_contact(uuid) from public, anon;
grant execute on function public.org_pet_owner_contact(uuid) to authenticated;

-- §13: si quien reporta un hallazgo esta autenticado y autorizo compartir su
-- contacto, y no escribio uno a mano, se usa el telefono de su perfil.
create or replace function public.submit_report_event(p_public_id text, p_type text, p_city text, p_neighborhood text, p_happened_on date DEFAULT NULL::date, p_happened_at_approx text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_pet_condition text DEFAULT NULL::text, p_finder_name text DEFAULT NULL::text, p_finder_contact text DEFAULT NULL::text, p_selected_org_id uuid DEFAULT NULL::uuid, p_photo_path text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pet_id uuid;
  v_pet_name text;
  v_owner uuid;
  v_report_id uuid;
  v_stage text;
  v_org_id uuid := null;
  v_org_name text;
  v_event_id uuid;
  v_recent integer;
  v_total integer;
  v_new_stage text;
  v_rank_new integer;
  v_rank_cur integer;
  v_prefix text;
  v_title text;
  v_body text;
  v_resolved_public_id text;
  v_caller uuid := (select auth.uid());
  v_finder_contact text := p_finder_contact;
  v_finder_name text := p_finder_name;
begin
  if p_type not in ('sighting', 'found', 'found_needs_help') then
    raise exception 'Tipo de aviso no valido.';
  end if;
  if coalesce(btrim(p_city), '') = '' or coalesce(btrim(p_neighborhood), '') = '' then
    raise exception 'La ciudad y la zona son obligatorias.';
  end if;

  -- Autorizacion opt-in del que encuentra (usuario autenticado).
  if v_caller is not null and p_type in ('found', 'found_needs_help')
     and coalesce(btrim(coalesce(v_finder_contact, '')), '') = '' then
    if exists (select 1 from public.user_privacy_preferences pp
               where pp.user_id = v_caller and pp.allow_found_pet_contact_sharing) then
      select nullif(btrim(coalesce(pr.phone, '')), ''),
             nullif(btrim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), '')
        into v_finder_contact, v_finder_name
      from public.profiles pr where pr.id = v_caller;
      if v_finder_name is null then v_finder_name := p_finder_name; end if;
    end if;
  end if;

  if p_type in ('found', 'found_needs_help')
     and coalesce(btrim(coalesce(v_finder_contact, '')), '') = '' then
    raise exception 'Indica un medio de contacto para que la familia pueda comunicarse contigo.';
  end if;
  if p_pet_condition is not null
     and p_pet_condition not in ('ok', 'scared', 'injured', 'needs_attention') then
    raise exception 'Estado de la mascota no valido.';
  end if;

  select p.public_id into v_resolved_public_id
  from public.qr_tags t
  join public.pets p on p.id = t.owner_pet_id
  where t.public_id = p_public_id and t.status = 'active';
  v_resolved_public_id := coalesce(v_resolved_public_id, p_public_id);

  select p.id, p.name, r.owner_id, r.id, r.stage
    into v_pet_id, v_pet_name, v_owner, v_report_id, v_stage
  from public.pets p
  join public.pet_reports r
    on r.pet_id = p.id and r.status = 'active' and r.kind = 'lost'
  where p.public_id = v_resolved_public_id and not p.is_archived
  limit 1;

  if v_report_id is null then
    raise exception 'Esta mascota no tiene un reporte de busqueda activo.';
  end if;

  select count(*) into v_recent
  from public.pet_report_events
  where report_id = v_report_id and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Demasiados avisos recientes para esta mascota. Intenta de nuevo mas tarde.';
  end if;
  select count(*) into v_total
  from public.pet_report_events where report_id = v_report_id;
  if v_total >= 40 then
    raise exception 'Este reporte alcanzo el maximo de avisos registrados.';
  end if;

  if p_type = 'found_needs_help' and p_selected_org_id is not null then
    select o.id, o.name into v_org_id, v_org_name
    from public.organization_profiles o
    where o.id = p_selected_org_id
      and o.status = 'published' and o.approval_status = 'approved' and o.is_active;
  end if;

  if p_photo_path is not null then
    v_prefix := 'reports/' || v_report_id::text || '/';
    if left(p_photo_path, length(v_prefix)) <> v_prefix then
      raise exception 'Ruta de foto no valida.';
    end if;
  end if;

  insert into public.pet_report_events (
    report_id, pet_id, owner_id, type, city, neighborhood,
    happened_on, happened_at_approx, description, pet_condition,
    finder_name, finder_contact, selected_org_id, selected_org_at, photo_path
  ) values (
    v_report_id, v_pet_id, v_owner, p_type,
    btrim(p_city), btrim(p_neighborhood),
    p_happened_on,
    nullif(left(btrim(coalesce(p_happened_at_approx, '')), 20), ''),
    nullif(left(btrim(coalesce(p_description, '')), 400), ''),
    p_pet_condition,
    nullif(left(btrim(coalesce(v_finder_name, '')), 80), ''),
    nullif(left(btrim(coalesce(v_finder_contact, '')), 120), ''),
    v_org_id,
    case when v_org_id is not null then now() else null end,
    p_photo_path
  )
  returning id into v_event_id;

  v_new_stage := case p_type
    when 'sighting' then 'sighted'
    when 'found' then 'in_contact'
    when 'found_needs_help' then case when v_org_id is not null then 'in_organization' else 'in_contact' end
  end;
  v_rank_new := case v_new_stage when 'sighted' then 1 when 'in_contact' then 2 when 'in_organization' then 3 else 0 end;
  v_rank_cur := case v_stage when 'sighted' then 1 when 'in_contact' then 2 when 'in_organization' then 3 else 0 end;
  if v_rank_new > v_rank_cur then
    update public.pet_reports set stage = v_new_stage where id = v_report_id;
  end if;

  if v_org_id is not null then
    v_title := 'Un usuario encontró a ' || v_pet_name;
    v_body := 'Y la llevará a ' || v_org_name || '. Esto es pendiente de entrega: aún no significa que ' ||
              v_org_name || ' la recibió. Te avisaremos cuando lo confirmen.';
  else
    v_title := case p_type
      when 'sighting' then 'Alguien vio a tu mascota'
      when 'found' then 'Alguien tiene posiblemente a tu mascota'
      else 'Alguien tiene a tu mascota y busca ayuda'
    end;
    v_body := 'Zona: ' || btrim(p_city) || ' - ' || btrim(p_neighborhood)
      || '. Revisa el aviso en Mis reportes.';
  end if;

  insert into public.notifications (user_id, type, report_id, event_id, title, body)
  values (
    v_owner,
    case p_type when 'sighting' then 'event_sighting'
                when 'found' then 'event_found'
                else 'event_found_needs_help' end,
    v_report_id, v_event_id, v_title, v_body
  );

  return v_event_id;
end;
$function$;

-- D3 / §2 / §3: borrar en lote los reportes CERRADOS del titular (cascada a
-- pet_report_events y notifications). Verifica ownership y estado server-side.
create or replace function public.delete_my_closed_reports(p_ids uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;
  if array_length(p_ids, 1) > 500 then
    raise exception 'Demasiados elementos en una sola operacion.';
  end if;

  with del as (
    delete from public.pet_reports
    where id = any(p_ids) and owner_id = v_uid and status = 'closed'
    returning 1
  )
  select count(*) into v_count from del;
  return v_count;
end;
$$;
revoke all on function public.delete_my_closed_reports(uuid[]) from public, anon;
grant execute on function public.delete_my_closed_reports(uuid[]) to authenticated;
