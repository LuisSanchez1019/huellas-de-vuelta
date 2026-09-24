-- Habilita 'proveedor' como kind/category válido de organization_profiles,
-- actualiza el trigger de alta y la comprobación de nombre duplicado, y
-- endurece la lectura pública para que solo los kinds explícitamente
-- diseñados para tener directorio público (fundacion/veterinaria, y aliado
-- con autorización) puedan llegar a ser visibles. 'proveedor' no tiene hoy
-- ningún directorio público: queda fuera de esa lista por diseño.

alter table public.organization_profiles
  drop constraint organization_profiles_kind_check,
  add constraint organization_profiles_kind_check
    check (kind = any (array['fundacion', 'veterinaria', 'aliado', 'proveedor']));

alter table public.organization_profiles
  drop constraint organization_profiles_category_check,
  add constraint organization_profiles_category_check
    check (category = any (array['veterinaria', 'fundacion', 'refugio', 'otro_aliado', 'proveedor']));

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
                    when 'proveedor' then 'proveedor'
                    else 'usuario'
                  end);
  v_org_name text := btrim(regexp_replace(coalesce(new.raw_user_meta_data ->> 'org_name', ''), '\s+', ' ', 'g'));
  v_consent_version text := btrim(coalesce(new.raw_user_meta_data ->> 'policy_consent_version', ''));
  v_category text;
  v_slug text;
begin
  -- Consentimiento obligatorio de la Politica de Tratamiento de Datos Personales.
  if v_consent_version <> public._current_data_policy_version() then
    raise exception 'Debes aceptar la Politica de Tratamiento de Datos Personales vigente para crear la cuenta.';
  end if;

  insert into public.profiles (id, display_name, first_name, last_name, role)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    v_role::public.account_role
  );

  -- Prueba del consentimiento (inmutable, append-only).
  insert into public.user_policy_consents (user_id, policy_type, policy_version)
  values (new.id, 'data_processing', v_consent_version)
  on conflict (user_id, policy_type, policy_version) do nothing;

  if v_role in ('veterinaria', 'fundacion', 'aliado', 'proveedor') and char_length(v_org_name) >= 2 then
    v_category := case
                    when v_role = 'aliado' then 'otro_aliado'
                    when v_role = 'proveedor' then 'proveedor'
                    else v_role
                  end;
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
  if p_kind not in ('veterinaria', 'fundacion', 'aliado', 'proveedor') then
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

drop policy org_profiles_public_read on public.organization_profiles;
create policy org_profiles_public_read
  on public.organization_profiles for select
  to anon, authenticated
  using (
    status = 'published' and approval_status = 'approved' and is_active
    and (
      kind = any (array['fundacion', 'veterinaria'])
      or (kind = 'aliado' and public._org_authorization_status(id, 'public_info') = 'granted')
    )
  );
