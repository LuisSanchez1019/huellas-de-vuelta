-- Prueba: la identificacion veterinaria es SOLO por QR / NFC (public_id). El short_code y
-- los metodos barcode/manual ya no existen para este flujo. Todo se revierte.
-- Se espera: ningun renglon con FAIL.
do $$
declare
  vv text := public._current_data_policy_version();
  uo uuid := gen_random_uuid(); uv uuid := gen_random_uuid(); ua uuid := gen_random_uuid();
  pp uuid; batch uuid; org_v uuid; g uuid;
  res text := ''; r jsonb; err text; n int;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (uo,'zz-o@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz o','policy_consent_version',vv)),
    (uv,'zz-v@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz v','policy_consent_version',vv,'role','veterinaria','org_name','ZZ Vet')),
    (ua,'zz-a@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz a','policy_consent_version',vv));
  update public.profiles set is_admin = true where id = ua;
  select id into org_v from public.organization_profiles where owner_id = uv;
  insert into public.pets (owner_id, name, species) values (uo,'ZZ Mascota','dog') returning id into pp;
  insert into public.qr_batches (quantity, reference) values (1,'ZZ-B') returning id into batch;
  insert into public.qr_tags (public_id, short_code, batch_id, status, owner_pet_id, assigned_at)
    values ('zzqrtag00009','ZZQ-999',batch,'active',pp,now());
  perform set_config('request.jwt.claims', json_build_object('sub', ua,'role','authenticated')::text, true);
  set local role authenticated; perform public.set_org_approval(org_v, 'approved'); reset role;   -- veterinaria REALMENTE aprobada

  perform set_config('request.jwt.claims', json_build_object('sub', uv,'role','authenticated')::text, true);
  set local role authenticated;

  -- U1: el short_code NO identifica (aunque sea una veterinaria aprobada)
  begin r := public.vet_identify_pet('ZZQ-999', 'qr'); err := coalesce(r->>'outcome','?'); exception when others then err := sqlerrm; end;
  res := res || 'U1_short_code_no_identifica=' || case when err = 'invalid_code' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  begin r := public.vet_identify_pet('zzq-999', 'nfc'); err := coalesce(r->>'outcome','?'); exception when others then err := sqlerrm; end;
  res := res || 'U1b_short_code_minusculas_por_nfc=' || case when err = 'invalid_code' then 'OK' else 'FAIL(' || err || ')' end || E'\n';

  -- U2: metodos retirados
  begin r := public.vet_identify_pet('zzqrtag00009', 'barcode'); err := 'FAIL_acepto'; exception when others then err := sqlerrm; end;
  res := res || 'U2_barcode_rechazado=' || case when err = 'INVALID_METHOD' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  begin r := public.vet_identify_pet('zzqrtag00009', 'manual'); err := 'FAIL_acepto'; exception when others then err := sqlerrm; end;
  res := res || 'U2_manual_rechazado=' || case when err = 'INVALID_METHOD' then 'OK' else 'FAIL(' || err || ')' end || E'\n';

  -- U3: QR y NFC (public_id) siguen funcionando
  begin r := public.vet_identify_pet('zzqrtag00009', 'qr'); err := coalesce(r->>'outcome','?'); exception when others then err := sqlerrm; end;
  res := res || 'U3_qr_identifica=' || case when err = 'found' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  begin r := public.vet_identify_pet('zzqrtag00009', 'nfc'); err := coalesce(r->>'outcome','?'); exception when others then err := sqlerrm; end;
  res := res || 'U3_nfc_identifica=' || case when err = 'found' then 'OK' else 'FAIL(' || err || ')' end || E'\n';

  -- U4: solicitud de acceso
  begin r := public.vet_request_access('zzqrtag00009', array['can_read_medical'], '1h', 'x', 'barcode'); err := 'FAIL_acepto'; exception when others then err := sqlerrm; end;
  res := res || 'U4_solicitud_barcode_rechazada=' || case when err = 'INVALID_METHOD' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  begin r := public.vet_request_access('zzqrtag00009', array['can_read_medical'], '1h', 'x', 'manual'); err := 'FAIL_acepto'; exception when others then err := sqlerrm; end;
  res := res || 'U4_solicitud_manual_rechazada=' || case when err = 'INVALID_METHOD' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  begin r := public.vet_request_access('ZZQ-999', array['can_read_medical'], '1h', 'x', 'qr'); err := 'FAIL_acepto_short_code'; exception when others then err := sqlerrm; end;
  res := res || 'U4_solicitud_con_short_code_rechazada=' || case when err = 'PET_NOT_FOUND' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  begin r := public.vet_request_access('zzqrtag00009', array['can_read_medical'], '1h', 'x', 'qr'); err := coalesce(r->>'outcome','?'); exception when others then err := sqlerrm; end;
  res := res || 'U4_solicitud_qr_ok=' || case when err = 'created' then 'OK' else 'FAIL(' || err || ')' end || E'\n';

  -- U5: emergencia
  begin r := public.vet_emergency_access('ZZQ-999', 'emergencia simulada de auditoria', 'qr'); err := 'FAIL_acepto_short_code'; exception when others then err := sqlerrm; end;
  res := res || 'U5_emergencia_con_short_code_rechazada=' || case when err = 'PET_NOT_FOUND' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  begin r := public.vet_emergency_access('zzqrtag00009', 'emergencia simulada de auditoria', 'manual'); err := 'FAIL_acepto'; exception when others then err := sqlerrm; end;
  res := res || 'U5_emergencia_manual_rechazada=' || case when err = 'INVALID_METHOD' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  begin r := public.vet_emergency_access('zzqrtag00009', 'emergencia simulada de auditoria', 'nfc'); err := 'ok'; exception when others then err := sqlerrm; end;
  res := res || 'U5_emergencia_nfc_ok=' || case when err = 'ok' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  reset role;

  -- U6: la base rechaza los metodos retirados aunque alguien intente escribirlos
  select id into g from public.vet_access_grants where vet_user_id = uv limit 1;
  begin update public.vet_access_grants set identification_method = 'barcode' where id = g; err := 'FAIL_acepto'; exception when check_violation then err := 'check_violation'; end;
  res := res || 'U6_check_bd_rechaza_barcode=' || case when err = 'check_violation' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  begin update public.vet_access_grants set identification_method = 'manual' where id = g; err := 'FAIL_acepto'; exception when check_violation then err := 'check_violation'; end;
  res := res || 'U6_check_bd_rechaza_manual=' || case when err = 'check_violation' then 'OK' else 'FAIL(' || err || ')' end || E'\n';

  -- U7: la ficha publica tampoco se resuelve por short_code (solo por public_id)
  set local role anon;
  select count(*) into n from public.get_public_pet('ZZQ-999') where name is not null;
  res := res || 'U7_get_public_pet_short_code_sin_resultado=' || case when n = 0 then 'OK' else 'FAIL' end || E'\n';
  select count(*) into n from public.get_public_pet('zzqrtag00009') where name = 'ZZ Mascota';
  res := res || 'U7_get_public_pet_public_id_ok=' || case when n = 1 then 'OK' else 'FAIL' end || E'\n';
  -- U8: anon no puede identificar
  begin r := public.vet_identify_pet('zzqrtag00009', 'qr'); err := 'FAIL_acepto'; exception when others then err := sqlerrm; end;
  res := res || 'U8_anon_no_identifica=' || case when err like 'permission denied%' then 'OK' else 'FAIL(' || err || ')' end || E'\n';
  reset role;

  raise exception E'RESULTADO\n%', res;
end $$;
