-- Huellas de Vuelta: /m/<public_id> se resuelve por PLACA (qr_tags) y, si no hay
-- placa, cae al public_id historico de la mascota (compatibilidad). Tambien
-- resuelve mascotas de organizacion y anade la alerta medica publica.

drop function if exists public.get_public_pet(text);

create function public.get_public_pet(p_public_id text)
returns table (
  public_id text, name text, species text, species_other text, breed text,
  color_primary text, color_secondary text, color_tertiary text,
  age_value integer, age_unit text, age_text text, sex text, description text,
  status text, photo_path text,
  report_id uuid, report_stage text, lost_city text, lost_neighborhood text,
  lost_details text, reported_at timestamptz,
  plate_code text, source_kind text, tag_state text,
  medical_alert boolean, medical_urgent boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tag_status text;
  v_tag_owner_pet uuid;
  v_tag_org_pet uuid;
  v_plate text := null;
  v_owner_pet uuid := null;
  v_org_pet uuid := null;
  v_tag_state text := null;
  v_had_tag boolean := false;
begin
  select t.status, t.owner_pet_id, t.org_pet_id, t.short_code
    into v_tag_status, v_tag_owner_pet, v_tag_org_pet, v_plate
  from public.qr_tags t
  where t.public_id = p_public_id;
  v_had_tag := found;

  if v_had_tag then
    if v_tag_status = 'active' then
      v_owner_pet := v_tag_owner_pet;
      v_org_pet := v_tag_org_pet;
      v_tag_state := 'active';
    else
      -- Placa existente pero no activa: se informa el estado, sin datos de mascota.
      return query select
        p_public_id, null::text, null::text, null::text, null::text,
        null::text, null::text, null::text,
        null::integer, null::text, null::text, null::text, null::text,
        null::text, null::text,
        null::uuid, null::text, null::text, null::text, null::text, null::timestamptz,
        v_plate, null::text, v_tag_status,
        false, false;
      return;
    end if;
  end if;

  -- Mascota de USUARIO: por placa activa, o (si no hubo placa) por public_id historico.
  if v_owner_pet is not null or not v_had_tag then
    return query
    select p.public_id, p.name, p.species, p.species_other, p.breed,
           p.color_primary, p.color_secondary, p.color_tertiary,
           p.age_value, p.age_unit, null::text, p.sex, p.description,
           p.status::text, p.photo_path,
           r.id, r.stage, r.city, r.neighborhood, r.details, r.created_at,
           v_plate, 'owner'::text, coalesce(v_tag_state, 'legacy'),
           coalesce(s.public_alert_enabled
                    and (s.has_condition or s.has_allergy or s.has_medication or s.has_urgent), false),
           coalesce(s.public_urgent_enabled and s.has_urgent, false)
    from public.pets p
    left join public.pet_reports r
      on r.pet_id = p.id and r.status = 'active' and p.status = 'lost'
    left join public.pet_medical_summary s on s.owner_pet_id = p.id
    where ((v_owner_pet is not null and p.id = v_owner_pet)
        or (v_owner_pet is null and p.public_id = p_public_id))
      and not p.is_archived;
    if found then return; end if;
  end if;

  -- Mascota de ORGANIZACION: por placa activa, o por public_id historico.
  return query
  select op.public_id, op.name, op.species, op.species_other, op.breed,
         null::text, null::text, null::text,
         null::integer, null::text, op.age, op.sex, null::text,
         (case when op.needs_home or op.needs_sponsor then 'for_adoption' else 'at_home' end),
         op.photo_path,
         null::uuid, null::text, null::text, null::text, null::text, null::timestamptz,
         v_plate, 'org'::text, coalesce(v_tag_state, 'legacy'),
         coalesce(s.public_alert_enabled
                  and (s.has_condition or s.has_allergy or s.has_medication or s.has_urgent), false),
         coalesce(s.public_urgent_enabled and s.has_urgent, false)
  from public.organization_pets op
  left join public.pet_medical_summary s on s.org_pet_id = op.id
  where (v_org_pet is not null and op.id = v_org_pet)
     or (v_org_pet is null and v_owner_pet is null and op.public_id = p_public_id);
end;
$$;

revoke all on function public.get_public_pet(text) from public;
grant execute on function public.get_public_pet(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_report_event: acepta el public_id de una PLACA activa o el historico.
-- ---------------------------------------------------------------------------
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
begin
  if p_type not in ('sighting', 'found', 'found_needs_help') then
    raise exception 'Tipo de aviso no valido.';
  end if;
  if coalesce(btrim(p_city), '') = '' or coalesce(btrim(p_neighborhood), '') = '' then
    raise exception 'La ciudad y la zona son obligatorias.';
  end if;
  if p_type in ('found', 'found_needs_help')
     and coalesce(btrim(p_finder_contact), '') = '' then
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
    nullif(left(btrim(coalesce(p_finder_name, '')), 80), ''),
    nullif(left(btrim(coalesce(p_finder_contact, '')), 120), ''),
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

-- ---------------------------------------------------------------------------
-- is_public_pet_photo: tambien la foto de una mascota de organizacion con placa
-- activa o ya visible en la Landing (needs_home / needs_sponsor).
-- ---------------------------------------------------------------------------
create or replace function public.is_public_pet_photo(object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.pets
    where photo_path = object_name
      and status in ('lost', 'found', 'for_adoption')
      and not is_archived
  )
  or exists (
    select 1 from public.organization_pets op
    where op.photo_path = object_name
      and (
        op.needs_home or op.needs_sponsor
        or exists (select 1 from public.qr_tags t where t.org_pet_id = op.id and t.status = 'active')
      )
  )
$function$;
