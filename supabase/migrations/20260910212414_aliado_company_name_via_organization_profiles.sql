-- FASE 1.1 — El registro de aliados guarda el "Nombre de la empresa" en la MISMA
-- estructura que veterinarias/fundaciones (organization_profiles), como dato
-- independiente del nombre personal (que sigue en profiles.first_name/last_name).
-- No se crea estructura paralela.

-- 1) organization_profiles.kind admite 'aliado' (el enum account_role ya lo tiene).
alter table public.organization_profiles drop constraint organization_profiles_kind_check;
alter table public.organization_profiles
  add constraint organization_profiles_kind_check
  check (kind in ('fundacion', 'veterinaria', 'aliado'));

-- El índice único (kind, name_norm) y el trigger enforce_org_kind_matches_role
-- (kind debe == profiles.role) ya cubren aliado sin cambios: una empresa aliada
-- no puede duplicar su nombre y el kind queda atado al rol real de la cuenta.

-- 2) handle_new_user(): crea también la fila mínima de organización para aliado,
--    con category = 'otro_aliado' (el CHECK de category no admite 'aliado').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text := (case new.raw_user_meta_data ->> 'role'
                    when 'fundacion' then 'fundacion'
                    when 'veterinaria' then 'veterinaria'
                    when 'aliado' then 'aliado'
                    else 'usuario'
                  end);
  v_org_name text := btrim(regexp_replace(coalesce(new.raw_user_meta_data ->> 'org_name', ''), '\s+', ' ', 'g'));
  v_category text;
  v_slug text;
begin
  insert into public.profiles (id, display_name, first_name, last_name, role)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    v_role::public.account_role
  );

  if v_role in ('veterinaria', 'fundacion', 'aliado') and char_length(v_org_name) >= 2 then
    v_category := case when v_role = 'aliado' then 'otro_aliado' else v_role end;
    v_slug := nullif(
      trim(both '-' from regexp_replace(
        translate(lower(v_org_name),
          'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
        '[^a-z0-9]+', '-', 'g')),
      ''
    );
    v_slug := coalesce(v_slug, v_role) || '-' || left(new.id::text, 8);

    insert into public.organization_profiles
      (owner_id, kind, category, slug, name, status, approval_status, is_active, hours, services, social)
    values
      (new.id, v_role, v_category, v_slug, v_org_name, 'draft', 'pending', true,
       '[]'::jsonb, '{}'::text[], '{}'::jsonb);
  end if;

  return new;
end;
$function$;

-- 3) org_name_available(): el pre-chequeo del frontend acepta 'aliado'.
create or replace function public.org_name_available(p_kind text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_norm text := lower(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
begin
  if p_kind not in ('veterinaria', 'fundacion', 'aliado') then
    return false;
  end if;
  if char_length(v_norm) < 2 then
    return false;
  end if;
  return not exists (
    select 1 from public.organization_profiles o
    where o.kind = p_kind
      and o.name_norm = v_norm
      and o.owner_id is distinct from (select auth.uid())
  );
end;
$function$;

-- 4) list_map_organizations(): defensa — nunca mostrar aliados en el mapa
--    (aunque una empresa aliada nunca alcanza el estado publicado+aprobado+con
--    coordenadas por ningún flujo actual, se blinda por si acaso).
create or replace function public.list_map_organizations()
returns table(id uuid, kind text, category text, name text, description text, logo_path text, logo_url text, city text, neighborhood text, address text, lat double precision, lng double precision, phone text, whatsapp text, hours jsonb, services jsonb, map_url text)
language sql
stable
security definer
set search_path to ''
as $function$
  select o.id, o.kind, o.category, o.name, o.description,
         o.logo_path, o.logo_url,
         o.city, o.neighborhood, o.address,
         o.lat, o.lng,
         o.phone, o.whatsapp, o.hours,
         coalesce((
           select jsonb_agg(jsonb_build_object('slug', sc.slug, 'name', sc.name, 'icon', sc.icon) order by sc.sort_order)
           from public.organization_services os
           join public.service_catalog sc on sc.id = os.service_id
           where os.organization_id = o.id
         ), '[]'::jsonb) as services,
         o.map_url
  from public.organization_profiles o
  where o.kind in ('veterinaria', 'fundacion')
    and o.status = 'published'
    and o.approval_status = 'approved'
    and o.is_active
    and o.lat is not null
    and o.lng is not null
    and o.lat between -90 and 90
    and o.lng between -180 and 180
    and not (o.lat = 0 and o.lng = 0)
  order by o.name
$function$;
