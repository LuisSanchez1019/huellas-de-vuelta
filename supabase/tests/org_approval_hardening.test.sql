-- Prueba de seguridad H-01 (una organizacion NO puede autoaprobarse).
-- Ejecutar en el SQL Editor de Supabase o con el MCP execute_sql. TODO se revierte:
-- el bloque termina con una excepcion que devuelve el resultado en el mensaje.
-- Se espera: ningun renglon con FAIL.
do $$
declare
  vv text := public._current_data_policy_version();
  uo uuid := gen_random_uuid();   -- propietario de la mascota
  uv uuid := gen_random_uuid();   -- veterinaria con organizacion PENDIENTE
  uw uuid := gen_random_uuid();   -- veterinaria SIN organizacion
  ua uuid := gen_random_uuid();   -- administrador
  pp uuid; batch uuid; item uuid; org_v uuid;
  res text := ''; r jsonb; n int; s text; err text;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (uo,'zz-o@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz o','policy_consent_version',vv)),
    (uv,'zz-v@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz v','policy_consent_version',vv,'role','veterinaria','org_name','ZZ Vet Pendiente')),
    (uw,'zz-w@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz w','policy_consent_version',vv,'role','veterinaria')),
    (ua,'zz-a@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz a','policy_consent_version',vv));
  update public.profiles set is_admin = true where id = ua;   -- como superusuario (sin JWT)
  select id into org_v from public.organization_profiles where owner_id = uv;

  insert into public.pets (owner_id, name, species) values (uo,'ZZ Victima','dog') returning id into pp;
  insert into public.qr_batches (quantity, reference) values (1,'ZZ-B') returning id into batch;
  insert into public.qr_tags (public_id, short_code, batch_id, status, owner_pet_id, assigned_at)
    values ('zzqrtag00009','ZZQ-999',batch,'active',pp,now());
  perform set_config('request.jwt.claims', json_build_object('sub', uo,'role','authenticated')::text, true);
  set local role authenticated;
  item := public.pet_medical_item_add('owner', pp, 'allergy', 'Penicilina-ZZ', 'anafilaxia');
  perform public.owner_set_emergency_visible(item, true);
  reset role;

  -- ===== T1: autoaprobarse por UPDATE (organizacion pendiente) =====
  perform set_config('request.jwt.claims', json_build_object('sub', uv,'role','authenticated')::text, true);
  set local role authenticated;
  update public.organization_profiles set approval_status='approved', is_active=true, verified_at=now(), qr_prefix='ZZA', rejection_reason='x' where id = org_v;
  reset role;
  select (approval_status='pending' and verified_at is null and qr_prefix is null)::text into s from public.organization_profiles where id = org_v;
  res := res || 'T1_update_no_aprueba=' || case when s='true' then 'OK' else 'FAIL' end || E'\n';

  -- ===== T2: borrar la propia organizacion =====
  set local role authenticated;
  begin delete from public.organization_profiles where id = org_v; err := 'sin_error';
  exception when others then err := sqlerrm; end;
  reset role;
  select count(*) into n from public.organization_profiles where id = org_v;
  res := res || 'T2_delete_bloqueado=' || case when n = 1 then 'OK' else 'FAIL' end || ' (' || err || ')' || E'\n';

  -- ===== T3: insertar directamente una organizacion ya aprobada (cuenta sin organizacion) =====
  perform set_config('request.jwt.claims', json_build_object('sub', uw,'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.organization_profiles (owner_id, kind, name, slug, approval_status, is_active, status, qr_prefix, verified_at)
    values (uw, 'veterinaria', 'ZZ Falsa Vet', 'zz-falsa-' || left(uw::text,6), 'approved', true, 'published', 'ZZB', now());
  reset role;
  select (approval_status='pending' and verified_at is null and qr_prefix is null and verified_by is null)::text into s from public.organization_profiles where owner_id = uw;
  res := res || 'T3_insert_nace_pendiente=' || case when s='true' then 'OK' else 'FAIL' end || E'\n';

  -- ===== T4: upsert (como hace la app) no eleva el estado =====
  set local role authenticated;
  insert into public.organization_profiles (owner_id, kind, name, slug, approval_status, status, description)
    values (uw, 'veterinaria', 'ZZ Falsa Vet', 'zz-falsa-' || left(uw::text,6), 'approved', 'published', 'descripcion legitima')
    on conflict (owner_id) do update set description = excluded.description, approval_status = excluded.approval_status;
  reset role;
  select (approval_status='pending')::text into s from public.organization_profiles where owner_id = uw;
  res := res || 'T4_upsert_no_eleva=' || case when s='true' then 'OK' else 'FAIL' end || E'\n';

  -- ===== T5: organizacion no aprobada NO puede identificar ni pedir acceso ni emergencia =====
  foreach s in array array['uv','uw'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', case s when 'uv' then uv else uw end,'role','authenticated')::text, true);
    set local role authenticated;
    begin r := public.vet_identify_pet('zzqrtag00009', 'qr'); err := 'FAIL_identifico'; exception when others then err := sqlerrm; end;
    res := res || 'T5_' || s || '_identify=' || case when err = 'VET_NOT_AUTHORIZED' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
    begin r := public.vet_request_access('zzqrtag00009', array['can_read_medical'], '1h', 'motivo', 'qr'); err := 'FAIL_solicito'; exception when others then err := sqlerrm; end;
    res := res || 'T5_' || s || '_request=' || case when err = 'VET_NOT_AUTHORIZED' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
    begin r := public.vet_emergency_access('zzqrtag00009', 'emergencia simulada de auditoria', 'qr'); err := 'FAIL_emergencia'; exception when others then err := sqlerrm; end;
    res := res || 'T5_' || s || '_emergency=' || case when err = 'VET_NOT_AUTHORIZED' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
    reset role;
  end loop;

  -- ===== T6: solo el administrador aprueba; ahi si funciona =====
  perform set_config('request.jwt.claims', json_build_object('sub', ua,'role','authenticated')::text, true);
  set local role authenticated;
  perform public.set_org_approval(org_v, 'approved');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uv,'role','authenticated')::text, true);
  set local role authenticated;
  begin r := public.vet_identify_pet('zzqrtag00009', 'qr'); err := coalesce(r->>'outcome','sin_outcome'); exception when others then err := sqlerrm; end;
  res := res || 'T6_aprobada_por_admin_identifica=' || case when err = 'found' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  begin r := public.vet_emergency_access('zzqrtag00009', 'emergencia simulada de auditoria', 'qr'); err := case when jsonb_array_length(r->'items') = 1 then 'ok' else 'sin_items' end; exception when others then err := sqlerrm; end;
  res := res || 'T6_aprobada_emergencia_solo_items_marcados=' || case when err = 'ok' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  reset role;

  -- ===== T7: la organizacion aprobada actualiza sus datos permitidos, sin tocar aprobacion =====
  set local role authenticated;
  update public.organization_profiles set description = 'texto nuevo', phone = '3001234567', approval_status = 'pending', qr_prefix = 'ZZC' where id = org_v;
  reset role;
  select (description = 'texto nuevo' and approval_status = 'approved' and qr_prefix is null)::text into s from public.organization_profiles where id = org_v;
  res := res || 'T7_actualiza_datos_y_conserva_aprobacion=' || case when s='true' then 'OK' else 'FAIL' end || E'\n';

  -- ===== T8: desactivada por el administrador => sin acceso; reactivada => vuelve =====
  perform set_config('request.jwt.claims', json_build_object('sub', ua,'role','authenticated')::text, true);
  set local role authenticated; perform public.set_org_active(org_v, false); reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uv,'role','authenticated')::text, true);
  set local role authenticated;
  begin r := public.vet_identify_pet('zzqrtag00009', 'qr'); err := 'FAIL_identifico'; exception when others then err := sqlerrm; end;
  res := res || 'T8_desactivada_sin_acceso=' || case when err = 'VET_NOT_AUTHORIZED' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ua,'role','authenticated')::text, true);
  set local role authenticated; perform public.set_org_active(org_v, true); reset role;

  -- ===== T9: rechazada por el administrador => sin acceso =====
  set local role authenticated; perform public.set_org_approval(org_v, 'rejected', 'prueba'); reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uv,'role','authenticated')::text, true);
  set local role authenticated;
  begin r := public.vet_identify_pet('zzqrtag00009', 'qr'); err := 'FAIL_identifico'; exception when others then err := sqlerrm; end;
  res := res || 'T9_rechazada_sin_acceso=' || case when err = 'VET_NOT_AUTHORIZED' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  reset role;

  -- ===== T10: aprobada sin verified_at (fila forzada por un superusuario) no autoriza =====
  update public.organization_profiles set approval_status = 'approved', is_active = true, verified_at = null where id = org_v;
  perform set_config('request.jwt.claims', json_build_object('sub', uv,'role','authenticated')::text, true);
  set local role authenticated;
  begin r := public.vet_identify_pet('zzqrtag00009', 'qr'); err := 'FAIL_identifico'; exception when others then err := sqlerrm; end;
  res := res || 'T10_aprobada_sin_verificacion_no_autoriza=' || case when err = 'VET_NOT_AUTHORIZED' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  reset role;

  -- ===== T11: un usuario comun no puede aprobar por RPC =====
  perform set_config('request.jwt.claims', json_build_object('sub', uw,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.set_org_approval((select id from public.organization_profiles where owner_id = uw), 'approved'); err := 'FAIL_aprobo'; exception when others then err := sqlerrm; end;
  res := res || 'T11_rpc_aprobar_denegada=' || case when err = 'No autorizado.' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  reset role;

  raise exception E'RESULTADO\n%', res;
end $$;
