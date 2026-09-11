-- 8/10: crear una cuenta EXIGE aceptar la Politica de Tratamiento de Datos
-- Personales. El servidor lo valida: sin 'policy_consent_version' vigente en los
-- metadatos, el registro se rechaza (aunque se llame a signUp manipulado). Se
-- registra la prueba del consentimiento en user_policy_consents.
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
