-- §19-22: soporte de eliminacion de cuenta.
--   * account_deletion_precheck(): lo llama la UI para mostrar los bloqueos.
--   * _account_deletion_prepare(uid): lo llama SOLO la Edge Function (service_role)
--     tras verificar identidad y contrasena; revalida los bloqueos y anonimiza
--     las referencias con ON DELETE NO ACTION antes de borrar el usuario de Auth.
-- El borrado real de auth.users lo hace la Edge Function con la Admin API
-- (nunca service_role en el navegador). Al borrarse auth.users se libera el
-- correo (sin lista negra) y cascada a profiles -> pets/reportes/notificaciones/
-- organizacion.

create or replace function public.account_deletion_precheck()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_is_admin boolean;
  v_admin_count integer;
  v_active_reports integer;
  v_open_orders integer;
  v_has_org boolean;
  v_blockers jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select is_admin into v_is_admin from public.profiles where id = v_uid;
  select count(*) into v_admin_count from public.profiles where is_admin;
  select count(*) into v_active_reports from public.pet_reports where owner_id = v_uid and status = 'active';
  select count(*) into v_open_orders from public.plate_orders
    where user_id = v_uid and order_status not in ('cancelled', 'delivered');
  select exists (select 1 from public.organization_profiles where owner_id = v_uid) into v_has_org;

  if coalesce(v_is_admin, false) and v_admin_count <= 1 then
    v_blockers := v_blockers || jsonb_build_object(
      'code', 'last_admin',
      'message', 'No puedes eliminar esta cuenta mientras seas el ultimo administrador activo. Primero debe existir otro administrador.');
  end if;
  if v_active_reports > 0 then
    v_blockers := v_blockers || jsonb_build_object(
      'code', 'active_reports',
      'message', 'Tienes ' || v_active_reports || ' reporte(s) de mascota perdida activo(s). Cierralos (marca la mascota como en casa) antes de eliminar la cuenta.');
  end if;
  if v_open_orders > 0 then
    v_blockers := v_blockers || jsonb_build_object(
      'code', 'open_orders',
      'message', 'Tienes ' || v_open_orders || ' pedido(s) de placa en curso. Espera a que se entreguen o cancelalos antes de eliminar la cuenta.');
  end if;
  if v_has_org then
    v_blockers := v_blockers || jsonb_build_object(
      'code', 'organization',
      'message', 'Esta cuenta gestiona una organizacion (veterinaria/fundacion). La eliminacion de cuentas de organizacion todavia no esta disponible; contacta al administrador.');
  end if;

  return jsonb_build_object(
    'can_delete', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers
  );
end;
$$;
revoke all on function public.account_deletion_precheck() from public, anon;
grant execute on function public.account_deletion_precheck() to authenticated;

-- Solo la Edge Function (service_role). Revalida y anonimiza.
create or replace function public._account_deletion_prepare(p_uid uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
  v_admin_count integer;
begin
  if p_uid is null then raise exception 'UID_REQUIRED'; end if;

  select is_admin into v_is_admin from public.profiles where id = p_uid;
  if v_is_admin is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  select count(*) into v_admin_count from public.profiles where is_admin;
  if coalesce(v_is_admin, false) and v_admin_count <= 1 then
    raise exception 'LAST_ADMIN';
  end if;
  if exists (select 1 from public.pet_reports where owner_id = p_uid and status = 'active') then
    raise exception 'ACTIVE_REPORTS';
  end if;
  if exists (select 1 from public.plate_orders where user_id = p_uid
             and order_status not in ('cancelled', 'delivered')) then
    raise exception 'OPEN_ORDERS';
  end if;
  if exists (select 1 from public.organization_profiles where owner_id = p_uid) then
    raise exception 'HAS_ORGANIZATION';
  end if;

  -- Anonimizar referencias con ON DELETE NO ACTION (bitacoras que deben
  -- conservarse: quedan sin actor, pero el registro historico sobrevive).
  update public.qr_tag_events set actor_id = null where actor_id = p_uid;
  update public.qr_batches set created_by = null where created_by = p_uid;
  update public.plate_order_events set actor_id = null where actor_id = p_uid;
  update public.shipment_events set created_by = null where created_by = p_uid;
  update public.organization_poster_events set actor_id = null where actor_id = p_uid;
  update public.organization_posters set approved_by = null where approved_by = p_uid;
  update public.organization_profiles set verified_by = null where verified_by = p_uid;
  update public.pet_medical_items set author_id = null where author_id = p_uid;
  update public.pet_medical_summary set updated_by = null where updated_by = p_uid;
end;
$$;
revoke all on function public._account_deletion_prepare(uuid) from public, anon, authenticated;
