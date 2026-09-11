-- §12: el perfil publico puede mostrar el telefono del titular SOLO si:
--   - el titular activo allow_public_phone (opt-in, por defecto false), y
--   - la mascota esta reportada como PERDIDA (hay reporte activo).
-- Nunca correo ni direccion. Mascotas de organizacion: owner_phone = null.
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
  medical_alert boolean, medical_urgent boolean,
  owner_phone text
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
      return query select
        p_public_id, null::text, null::text, null::text, null::text,
        null::text, null::text, null::text,
        null::integer, null::text, null::text, null::text, null::text,
        null::text, null::text,
        null::uuid, null::text, null::text, null::text, null::text, null::timestamptz,
        v_plate, null::text, v_tag_status,
        false, false, null::text;
      return;
    end if;
  end if;

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
           coalesce(s.public_alert_enabled and s.public_urgent_enabled and s.has_urgent, false),
           case when r.id is not null and coalesce(pp.allow_public_phone, false)
                then nullif(btrim(coalesce(own.phone, '')), '')
                else null end
    from public.pets p
    left join public.pet_reports r
      on r.pet_id = p.id and r.status = 'active' and p.status = 'lost'
    left join public.pet_medical_summary s on s.owner_pet_id = p.id
    left join public.profiles own on own.id = p.owner_id
    left join public.user_privacy_preferences pp on pp.user_id = p.owner_id
    where ((v_owner_pet is not null and p.id = v_owner_pet)
        or (v_owner_pet is null and p.public_id = p_public_id))
      and not p.is_archived;
    if found then return; end if;
  end if;

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
         coalesce(s.public_alert_enabled and s.public_urgent_enabled and s.has_urgent, false),
         null::text
  from public.organization_pets op
  left join public.pet_medical_summary s on s.org_pet_id = op.id
  where (v_org_pet is not null and op.id = v_org_pet)
     or (v_org_pet is null and v_owner_pet is null and op.public_id = p_public_id);
end;
$$;

revoke all on function public.get_public_pet(text) from public;
grant execute on function public.get_public_pet(text) to anon, authenticated;
