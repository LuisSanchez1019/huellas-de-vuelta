-- Prueba de la fuente de verdad QR <-> mascota (migracion 20260929000000_qr_source_of_truth_hardening).
-- Ejecutar con el SQL Editor de Supabase o con el MCP execute_sql. TODO se revierte: el bloque termina con
-- una excepcion que devuelve el resultado en el mensaje. Se espera: ningun renglon con FAIL.
create or replace function pg_temp.run(p_role text, p_uid uuid, p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  if p_role <> 'postgres' then execute format('set local role %I', p_role); end if;
  begin
    execute p_sql into v;
    v := coalesce(v, 'null');
  exception when others then
    v := 'ERR:' || sqlerrm;
  end;
  reset role;
  return v;
end $f$;

create or replace function pg_temp.chk(p_name text, p_ok boolean, p_detail text default '') returns text
language sql as $f$ select p_name || '=' || case when p_ok then 'OK' else 'FAIL(' || coalesce(p_detail, '') || ')' end || E'\n' $f$;

do $$
declare
  vv text := public._current_data_policy_version();
  ua uuid := gen_random_uuid();  -- propietario A (usuario)
  ub uuid := gen_random_uuid();  -- propietario B (usuario)
  up uuid := gen_random_uuid();  -- proveedor
  uv uuid := gen_random_uuid();  -- veterinaria
  ul uuid := gen_random_uuid();  -- aliado
  ud uuid := gen_random_uuid();  -- administrador
  ux uuid := gen_random_uuid();  -- usuario (borrara su cuenta)
  uf uuid := gen_random_uuid();  -- fundacion
  pa uuid; pa2 uuid; px uuid; pf uuid; pb uuid; pb2 uuid; pl uuid; pprov uuid; pal uuid; oporg uuid; oporg2 uuid; batch uuid; org_shipping uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; t6 uuid; tl uuid; tprov uuid;
  res text := ''; v text; n bigint; r record; ord1 uuid; ord2 uuid; shp uuid;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (ua,'zz-a@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz a','policy_consent_version',vv)),
    (ub,'zz-b@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz b','policy_consent_version',vv)),
    (up,'zz-p@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz p','policy_consent_version',vv,'role','proveedor','org_name','ZZ Prov')),
    (uv,'zz-v@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz v','policy_consent_version',vv,'role','veterinaria','org_name','ZZ Vet')),
    (ul,'zz-l@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz l','policy_consent_version',vv,'role','aliado')),
    (ud,'zz-d@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz d','policy_consent_version',vv)),
    (ux,'zz-x@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz x','policy_consent_version',vv)),
    (uf,'zz-f@test.invalid','authenticated','authenticated', jsonb_build_object('display_name','zz f','policy_consent_version',vv,'role','fundacion','org_name','ZZ Fund'));
  update public.profiles set is_admin = true where id = ud;
  update public.organization_profiles set qr_prefix = 'ZZP' where owner_id = up;
  insert into public.pets (owner_id,name,species) values (ua,'ZZ A','dog') returning id into pa;
  insert into public.pets (owner_id,name,species) values (ua,'ZZ A2','cat') returning id into pa2;
  insert into public.pets (owner_id,name,species) values (ub,'ZZ B','dog') returning id into pb;
  insert into public.pets (owner_id,name,species,status) values (ub,'ZZ Perdida','dog','lost') returning id into pl;
  insert into public.pets (owner_id,name,species) values (up,'ZZ Prov','dog') returning id into pprov;
  insert into public.pets (owner_id,name,species) values (ul,'ZZ Aliado','dog') returning id into pal;
  insert into public.pets (owner_id,name,species) values (ux,'ZZ X','dog') returning id into px;
  insert into public.pets (owner_id,name,species) values (uf,'ZZ Fund','dog') returning id into pf;
  insert into public.organization_pets (org_id, org_kind, name, species, sex, needs_home) values (uv,'veterinaria','ZZ OrgAdopcion','dog','male',true) returning id into oporg;
  insert into public.organization_pets (org_id, org_kind, name, species, sex, needs_home) values (uv,'veterinaria','ZZ OrgPrivada','dog','male',false) returning id into oporg2;
  insert into public.qr_batches (quantity, reference) values (6,'ZZ-B') returning id into batch;
  insert into public.qr_tags (public_id, short_code, batch_id, status) values ('zzqrtaga0001','ZZQ-901',batch,'available') returning id into t1;
  insert into public.qr_tags (public_id, short_code, batch_id, status) values ('zzqrtaga0002','ZZQ-902',batch,'available') returning id into t2;
  insert into public.qr_tags (public_id, short_code, batch_id, status) values ('zzqrtaga0003','ZZQ-903',batch,'available') returning id into t3;
  insert into public.qr_tags (public_id, short_code, batch_id, status) values ('zzqrtaga0004','ZZQ-904',batch,'available') returning id into t4;
  insert into public.qr_tags (public_id, short_code, batch_id, status) values ('zzqrtaga0005','ZZQ-905',batch,'available') returning id into t5;
  insert into public.qr_tags (public_id, short_code, batch_id, status) values ('zzqrtaga0006','ZZQ-906',batch,'available') returning id into t6;

  -- ================= I: identidad publica unica e inmutable =================
  v := pg_temp.run('authenticated', ub, format('update public.pets set public_id = %L where id = %L returning public_id', 'zzhijack0001', pb));
  res := res || pg_temp.chk('I1_dueno_no_cambia_public_id', v like '%PUBLIC_ID_IMMUTABLE%', v);
  v := pg_temp.run('authenticated', uv, format('update public.organization_pets set public_id = %L where id = %L returning public_id', 'zzhijack0002', oporg));
  res := res || pg_temp.chk('I2_organizacion_no_cambia_public_id', v like '%PUBLIC_ID_IMMUTABLE%', v);
  v := pg_temp.run('authenticated', ub, format('update public.pets set name = %L, public_id = public_id where id = %L returning name', 'ZZ B renombrada', pb));
  res := res || pg_temp.chk('I2b_actualizar_sin_cambiar_id_sigue_funcionando', v = 'ZZ B renombrada', v);
  v := pg_temp.run('authenticated', ub, format('insert into public.pets (owner_id, name, species, public_id) values (%L, %L, %L, %L) returning public_id', ub, 'ZZ Elegido', 'dog', 'zzchosen0001'));
  res := res || pg_temp.chk('I3_cliente_no_elige_public_id_al_crear', v not like 'ERR%' and v <> 'zzchosen0001', v);
  select public_id into v from public.organization_pets where id = oporg;
  insert into public.pets (owner_id, name, species, public_id) values (ub, 'ZZ Colision', 'dog', v) returning public_id into v;
  select (v <> (select public_id from public.organization_pets where id = oporg))::text into v;
  res := res || pg_temp.chk('I4_colision_entre_tablas_se_regenera', v = 'true', v);
  begin insert into public.qr_tags (public_id, short_code, batch_id, status) values ((select public_id from public.pets where id = pa), 'ZZQ-950', batch, 'available'); v := 'FAIL_inserto'; exception when others then v := sqlerrm; end;
  res := res || pg_temp.chk('I5_qr_no_puede_usar_el_id_de_una_mascota', v = 'PUBLIC_ID_COLLISION', v);
  v := pg_temp.run('authenticated', ud, format('update public.qr_tags set public_id = %L where id = %L', 'zzhijack0003', t1));
  res := res || pg_temp.chk('I6_ni_el_admin_por_API_cambia_el_id_del_qr', v like 'ERR:permission denied%', v);

  -- ================= P: perfil publico =================
  v := pg_temp.run('authenticated', ua, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0001', pa));
  res := res || pg_temp.chk('C0_claim_usuario_ok', v = 'active', v);
  v := pg_temp.run('anon', null, format($q$select to_jsonb(g)::text from public.get_public_pet(%L) g$q$, 'zzqrtaga0001'));
  res := res || pg_temp.chk('P1_qr_activo_devuelve_el_id_del_QR', (v::jsonb)->>'public_id' = 'zzqrtaga0001' and (v::jsonb)->>'name' = 'ZZ A' and (v::jsonb)->>'tag_state' = 'active', v);
  res := res || pg_temp.chk('P1b_no_expone_id_de_la_mascota_ni_uuid', position((select public_id from public.pets where id = pa) in v) = 0 and position(pa::text in v) = 0 and position(ua::text in v) = 0, '');
  res := res || pg_temp.chk('P1c_claves_con_valor', true, (select string_agg(k, ',' order by k) from jsonb_each(v::jsonb) e(k,val) where val <> 'null'::jsonb));

  -- id "de campana" de una mascota en casa NO abre el perfil, con o sin placa
  v := pg_temp.run('anon', null, format($q$select count(*)::text from public.get_public_pet(%L)$q$, (select public_id from public.pets where id = pa)));
  res := res || pg_temp.chk('P2_mascota_en_casa_no_se_resuelve_por_su_public_id', v = '0', v);

  foreach v in array array['suspended','replaced','annulled','assigned','available'] loop
    update public.qr_tags set status = v, owner_pet_id = case when v = 'available' then null else pa end where id = t1;
    n := (select count(*) from public.get_public_pet('zzqrtaga0001') where name is not null);
    res := res || pg_temp.chk('P3_' || v || '_por_QR_sin_datos_de_mascota', n = 0 and (select tag_state from public.get_public_pet('zzqrtaga0001')) = v, n::text);
    n := (select count(*) from public.get_public_pet((select public_id from public.pets where id = pa)) where name is not null);
    res := res || pg_temp.chk('P3_' || v || '_por_id_de_mascota_en_casa_sin_perfil', n = 0, n::text);
  end loop;

  -- campana publica: mascota perdida con placa anulada sigue visible SOLO como campana (decision documentada)
  update public.pets set photo_path = ub::text || '/' || pl::text || '/foto.webp' where id = pl;
  update public.qr_tags set status = 'active', owner_pet_id = pl, assigned_at = now() where id = t6;
  v := pg_temp.run('anon', null, format($q$select to_jsonb(g)::text from public.get_public_pet(%L) g$q$, 'zzqrtaga0006'));
  res := res || pg_temp.chk('P4_perdida_con_qr_activo_expone_foto_publica', (v::jsonb)->>'photo_path' is not null and (v::jsonb)->>'status' = 'lost', v);
  update public.pets set status = 'at_home' where id = pl;
  v := pg_temp.run('anon', null, format($q$select coalesce((select photo_path from public.get_public_pet(%L)), 'null')$q$, 'zzqrtaga0006'));
  res := res || pg_temp.chk('P5_foto_privada_no_viaja_(at_home)', v = 'null', v);
  update public.pets set status = 'lost' where id = pl;
  update public.qr_tags set status = 'annulled' where id = t6;
  v := pg_temp.run('anon', null, format($q$select count(*)::text from public.get_public_pet(%L) where name is not null$q$, (select public_id from public.pets where id = pl)));
  res := res || pg_temp.chk('P6_campana_perdida_visible_por_su_id_de_campana', v = '1', v);
  v := pg_temp.run('anon', null, format($q$select count(*)::text from public.get_public_pet(%L) where name is not null$q$, 'zzqrtaga0006'));
  res := res || pg_temp.chk('P6b_pero_el_id_del_QR_anulado_no_abre_nada', v = '0', v);

  v := pg_temp.run('anon', null, format($q$select count(*)::text from public.get_public_pet(%L) where name is not null$q$, (select public_id from public.organization_pets where id = oporg)));
  res := res || pg_temp.chk('P7_org_en_adopcion_visible', v = '1', v);
  v := pg_temp.run('anon', null, format($q$select count(*)::text from public.get_public_pet(%L) where name is not null$q$, (select public_id from public.organization_pets where id = oporg2)));
  res := res || pg_temp.chk('P7b_org_privada_no_visible_por_su_id', v = '0', v);

  -- placa heredada: el id del QR es ademas el id de la mascota (2 casos reales)
  alter table public.qr_tags disable trigger qr_tags_guard_public_id;
  alter table public.pets disable trigger pets_guard_public_id;
  update public.pets set public_id = 'zzlegacyid01' where id = pa2;
  insert into public.qr_tags (public_id, short_code, batch_id, status, owner_pet_id, assigned_at) values ('zzlegacyid01','ZZQ-907',batch,'active',pa2,now()) returning id into tl;
  alter table public.qr_tags enable trigger qr_tags_guard_public_id;
  alter table public.pets enable trigger pets_guard_public_id;
  v := pg_temp.run('anon', null, format($q$select count(*)::text from public.get_public_pet(%L) where name is not null$q$, 'zzlegacyid01'));
  res := res || pg_temp.chk('P8_placa_heredada_activa_abre_perfil', v = '1', v);
  update public.qr_tags set status = 'suspended' where id = tl;
  v := pg_temp.run('anon', null, format($q$select count(*)::text from public.get_public_pet(%L) where name is not null$q$, 'zzlegacyid01'));
  res := res || pg_temp.chk('P8b_placa_heredada_suspendida_cierra_el_perfil', v = '0', v);
  update public.qr_tags set status = 'annulled', owner_pet_id = null where id = tl;

  -- ================= C: claim =================
  update public.qr_tags set status = 'available', owner_pet_id = null, assigned_at = null where id = t1;
  insert into public.qr_tags (public_id, short_code, batch_id, status) values ('zzqrtaga0007','ZZQ-908',batch,'available') returning id into tprov;
  v := pg_temp.run('authenticated', up, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0007', pprov));
  res := res || pg_temp.chk('C1_proveedor_no_reclama', v = 'ERR:ROLE_NOT_ALLOWED', v);
  v := pg_temp.run('authenticated', uv, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0007', pa));
  res := res || pg_temp.chk('C1b_veterinaria_no_reclama', v = 'ERR:ROLE_NOT_ALLOWED', v);
  v := pg_temp.run('anon', null, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0007', pa));
  res := res || pg_temp.chk('C2_anonimo_no_reclama', v like 'ERR:permission denied%', v);
  v := pg_temp.run('authenticated', ub, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0007', pa));
  res := res || pg_temp.chk('C3_mascota_ajena', v = 'ERR:PET_NOT_FOUND', v);
  v := pg_temp.run('authenticated', ub, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zznoexiste000', pb));
  res := res || pg_temp.chk('C3b_qr_inexistente', v = 'ERR:TAG_NOT_FOUND', v);
  v := pg_temp.run('authenticated', ul, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0007', pal));
  res := res || pg_temp.chk('C4_aliado_no_reclama', v = 'ERR:ROLE_NOT_ALLOWED', v);
  v := pg_temp.run('authenticated', uf, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0007', pf));
  res := res || pg_temp.chk('C4b_fundacion_no_reclama', v = 'ERR:ROLE_NOT_ALLOWED', v);
  v := pg_temp.run('authenticated', ul, format($q$select public.qr_owner_set_pet_tag_state(%L, 'suspend', null)::text$q$, pal));
  res := res || pg_temp.chk('C4c_aliado_no_suspende', v = 'ERR:ROLE_NOT_ALLOWED', v);
  v := pg_temp.run('authenticated', ux, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0007', px));
  res := res || pg_temp.chk('C4d_usuario_reclama_su_mascota', v = 'active', v);
  foreach v in array array['active','suspended','replaced','annulled','assigned'] loop
    update public.qr_tags set status = v, owner_pet_id = case when v in ('assigned','active','suspended') then pa2 else null end where id = t2;
    res := res || pg_temp.chk('C5_reclamar_qr_' || v,
      pg_temp.run('authenticated', ub, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0002', pb)) =
      'ERR:' || case v when 'active' then 'TAG_ALREADY_ACTIVE' when 'suspended' then 'TAG_SUSPENDED' when 'replaced' then 'TAG_REPLACED' when 'annulled' then 'TAG_ANNULLED' else 'TAG_ALREADY_ASSIGNED' end, v);
  end loop;
  update public.qr_tags set status = 'annulled', owner_pet_id = null where id = t2;

  -- reemplazo: activa -> hay que suspender primero; suspendida -> el claim la reemplaza
  v := pg_temp.run('authenticated', ua, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0001', pa));
  res := res || pg_temp.chk('R1_claim_placa_1', v = 'active', v);
  v := pg_temp.run('authenticated', ua, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0003', pa));
  res := res || pg_temp.chk('R2_activa_exige_suspender_antes', v = 'ERR:PET_ALREADY_HAS_TAG', v);
  v := pg_temp.run('authenticated', ub, format($q$select public.qr_owner_set_pet_tag_state(%L, 'suspend', 'perdi la placa')::text$q$, pa));
  res := res || pg_temp.chk('R3_otro_usuario_no_suspende_mi_placa', v = 'ERR:PET_NOT_FOUND', v);
  v := pg_temp.run('authenticated', up, format($q$select public.qr_owner_set_pet_tag_state(%L, 'suspend', null)::text$q$, pa));
  res := res || pg_temp.chk('R3b_proveedor_no_suspende', v = 'ERR:ROLE_NOT_ALLOWED', v);
  v := pg_temp.run('anon', null, format($q$select public.qr_owner_set_pet_tag_state(%L, 'suspend', null)::text$q$, pa));
  res := res || pg_temp.chk('R3c_anonimo_no_suspende', v like 'ERR:permission denied%', v);
  v := pg_temp.run('authenticated', ua, format($q$select public.qr_owner_set_pet_tag_state(%L, 'suspend', 'perdi la placa')::text$q$, pa));
  res := res || pg_temp.chk('R4_dueno_suspende_su_placa', v <> 'null' and v not like 'ERR%', v);
  res := res || pg_temp.chk('R4b_qr_suspendido_no_abre_perfil', (select count(*) from public.get_public_pet('zzqrtaga0001') where name is not null) = 0, '');
  v := pg_temp.run('authenticated', ua, format($q$select public.qr_owner_set_pet_tag_state(%L, 'resume', null)::text$q$, pa));
  res := res || pg_temp.chk('R5_dueno_reactiva_su_propia_suspension', v not like 'ERR%', v);
  -- suspension del administrador: el dueno no la revierte
  v := pg_temp.run('authenticated', ud, format($q$select public.qr_admin_set_state(%L, 'suspend', 'reporte de fraude')::text$q$, t1));
  res := res || pg_temp.chk('R6_admin_suspende', v not like 'ERR%', v);
  -- (en produccion cada accion es una transaccion distinta; aqui se separa el orden de los eventos)
  update public.qr_tag_events set created_at = now() + interval '1 second' where tag_id = t1 and event = 'suspended' and actor_id = ud;
  v := pg_temp.run('authenticated', ua, format($q$select public.qr_owner_set_pet_tag_state(%L, 'resume', null)::text$q$, pa));
  res := res || pg_temp.chk('R6b_dueno_no_revierte_suspension_de_admin', v = 'ERR:TAG_SUSPENDED_BY_ADMIN', v);
  -- reemplazo con placa nueva
  v := pg_temp.run('authenticated', ua, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0003', pa));
  res := res || pg_temp.chk('R7_claim_con_placa_suspendida_reemplaza', v = 'active', v);
  res := res || pg_temp.chk('R7b_anterior_replaced_y_enlazada', (select status || ':' || (replaced_by_tag_id = t3)::text from public.qr_tags where id = t1) = 'replaced:true', '');
  res := res || pg_temp.chk('R7c_una_sola_placa_viva', (select count(*) from public.qr_tags where owner_pet_id = pa and status in ('assigned','active','suspended')) = 1, '');
  res := res || pg_temp.chk('R7d_auditoria_replaced', (select count(*) from public.qr_tag_events where tag_id = t1 and event = 'replaced') = 1, '');
  res := res || pg_temp.chk('R7e_el_qr_anterior_no_vuelve_a_funcionar', (select count(*) from public.get_public_pet('zzqrtaga0001') where name is not null) = 0
    and pg_temp.run('authenticated', ua, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0001', pa)) = 'ERR:TAG_REPLACED', '');

  -- ================= F: frontera del proveedor y de los roles =================
  v := pg_temp.run('authenticated', up, $q$select (public.qr_provider_batch_create(1, 'zz')).batch_id::text$q$);
  res := res || pg_temp.chk('F1_proveedor_solo_genera_lotes', v not like 'ERR%', v);
  foreach v in array array[
    format($q$select public.qr_admin_set_state(%L, 'annul', 'x')::text$q$, t4),
    format($q$select public.qr_admin_assign(%L, 'owner', %L, true, 'x')::text$q$, t4, pprov),
    format($q$select public.qr_admin_replace(%L, %L, 'x')::text$q$, t4, t5),
    $q$select (public.qr_batch_create('zz', 1, 'ZZZ', null)).batch_id::text$q$,
    format($q$select public.plate_order_admin_assign_plate(%L, %L)::text$q$, gen_random_uuid(), t4)] loop
    res := res || pg_temp.chk('F2_proveedor_bloqueado:' || left(v, 40), pg_temp.run('authenticated', up, v) = 'ERR:No autorizado.', pg_temp.run('authenticated', up, v));
    res := res || pg_temp.chk('F2b_veterinaria_bloqueada:' || left(v, 40), pg_temp.run('authenticated', uv, v) = 'ERR:No autorizado.', pg_temp.run('authenticated', uv, v));
    res := res || pg_temp.chk('F2c_usuario_bloqueado:' || left(v, 40), pg_temp.run('authenticated', ub, v) = 'ERR:No autorizado.', pg_temp.run('authenticated', ub, v));
  end loop;
  v := pg_temp.run('authenticated', ub, format($q$update public.qr_tags set status = 'annulled' where id = %L returning id::text$q$, t4));
  res := res || pg_temp.chk('F3_update_directo_denegado_por_privilegios', v like 'ERR:permission denied%', v);
  v := pg_temp.run('authenticated', ub, $q$select count(*)::text from public.qr_tags$q$);
  res := res || pg_temp.chk('F3b_usuario_no_lista_qr_tags', v = '0', v);
  v := pg_temp.run('anon', null, $q$select count(*)::text from public.qr_tags$q$);
  res := res || pg_temp.chk('F3c_anon_sin_privilegios_sobre_qr_tags', v like 'ERR:permission denied%', v);

  -- ================= O: pedido y entrega ya no vinculan ni activan =================
  select id into org_shipping from public.shipping_zones limit 1;
  insert into public.plate_orders (reference, user_id, owner_pet_id, recipient_first_name, recipient_last_name, city, neighborhood, address, phone, email, shipping_zone_id, product_amount, shipping_amount, total_amount, currency, order_status, payment_status)
    values ('PO-ZZ-00001', ub, pb, 'Zz', 'Zz', 'Bogota', 'Centro', 'Calle 1 # 2-3', '3000000000', 'zz-b@test.invalid', org_shipping, 1000, 100, 1100, 'COP', 'confirmed', 'approved') returning id into ord1;
  insert into public.plate_orders (reference, user_id, owner_pet_id, recipient_first_name, recipient_last_name, city, neighborhood, address, phone, email, shipping_zone_id, product_amount, shipping_amount, total_amount, currency, order_status, payment_status)
    values ('PO-ZZ-00002', ua, pa2, 'Zz', 'Zz', 'Bogota', 'Centro', 'Calle 1 # 2-3', '3000000000', 'zz-a@test.invalid', org_shipping, 1000, 100, 1100, 'COP', 'confirmed', 'approved') returning id into ord2;
  v := pg_temp.run('authenticated', ud, format($q$select public.plate_order_admin_assign_plate(%L, %L)::text$q$, ord1, t4));
  res := res || pg_temp.chk('O1_admin_reserva_placa_para_el_pedido', v not like 'ERR%', v);
  res := res || pg_temp.chk('O2_la_placa_sigue_available_y_sin_mascota', (select status || ':' || coalesce(owner_pet_id::text, 'sin') from public.qr_tags where id = t4) = 'available:sin', '');
  v := pg_temp.run('authenticated', ud, format($q$select public.plate_order_admin_assign_plate(%L, %L)::text$q$, ord2, t4));
  res := res || pg_temp.chk('O3_una_placa_no_se_reserva_para_dos_pedidos', v like 'ERR:La placa ya esta reservada%', v);
  v := pg_temp.run('authenticated', ud, format($q$select (public.shipment_admin_create(%L, 'Servientrega', 'x')).shipment_id::text$q$, ord1));
  res := res || pg_temp.chk('O4_crear_envio', v not like 'ERR%', v);
  select id into shp from public.shipments where order_id = ord1;
  v := pg_temp.run('authenticated', ud, format($q$select public.shipment_admin_add_event(%L, 'DELIVERED', 'entregado')::text$q$, shp));
  res := res || pg_temp.chk('O5_entrega_registrada', v not like 'ERR%', v);
  res := res || pg_temp.chk('O6_ENTREGAR_NO_ACTIVA_EL_QR', (select status || ':' || coalesce(owner_pet_id::text, 'sin') from public.qr_tags where id = t4) = 'available:sin', '');
  v := pg_temp.run('authenticated', ub, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0004', pb));
  res := res || pg_temp.chk('O7_el_propietario_activa_con_su_claim', v = 'active', v);

  -- ================= D: eliminar mascota / cuenta =================
  -- mascota con pedido de placa: el pedido es un registro comercial y BLOQUEA el borrado (diseno existente)
  v := pg_temp.run('authenticated', ub, format('delete from public.pets where id = %L returning id::text', pb));
  res := res || pg_temp.chk('D0_mascota_con_pedido_no_se_borra_(RESTRICT_por_diseno)', v like 'ERR:%plate_orders_owner_pet_id_fkey%', v);
  -- mascota sin pedido: al eliminarla su placa queda ANULADA
  insert into public.pets (owner_id, name, species) values (ub, 'ZZ B2', 'cat') returning id into pb2;
  v := pg_temp.run('authenticated', ub, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0005', pb2));
  res := res || pg_temp.chk('D1_claim_de_la_mascota_a_eliminar', v = 'active', v);
  v := pg_temp.run('authenticated', ub, format('delete from public.pets where id = %L returning id::text', pb2));
  res := res || pg_temp.chk('D1b_dueno_elimina_su_mascota', v = pb2::text, v);
  res := res || pg_temp.chk('D2_su_placa_queda_ANULADA_no_disponible', (select status || ':' || coalesce(owner_pet_id::text, 'sin') from public.qr_tags where id = t5) = 'annulled:sin', '');
  res := res || pg_temp.chk('D3_evento_annulled', (select count(*) from public.qr_tag_events where tag_id = t5 and event = 'annulled') = 1, '');
  v := pg_temp.run('authenticated', ub, format('select (public.qr_claim_tag(%L, %L)).tag_status', 'zzqrtaga0005', pb));
  res := res || pg_temp.chk('D4_nadie_reutiliza_la_placa_anulada', v = 'ERR:TAG_ANNULLED', v);
  -- cuenta de quien reclamo (sin pedidos): ya se puede borrar
  begin delete from auth.users where id = ux; v := 'cuenta_borrada'; exception when others then v := sqlerrm; end;
  res := res || pg_temp.chk('D5_borrar_cuenta_de_quien_reclamo_ya_no_falla', v = 'cuenta_borrada', v);
  res := res || pg_temp.chk('D6_tras_borrar_cuenta_su_placa_queda_anulada', (select status from public.qr_tags where id = tprov) = 'annulled', '');
  res := res || pg_temp.chk('D7_eventos_conservados_sin_actor', (select count(*) from public.qr_tag_events where tag_id = tprov and actor_id is null and event = 'annulled') = 1
     and (select count(*) from public.qr_tag_events where tag_id = tprov and event = 'activated') = 1, '');

  -- ================= H: foto (ruta) y datos publicos =================
  v := pg_temp.run('authenticated', ub, format($q$update public.pets set photo_path = %L, status = 'lost' where id = %L returning id::text$q$, ua::text || '/otra/foto-privada.webp', pl));
  res := res || pg_temp.chk('H1_dueno_no_apunta_su_foto_a_la_carpeta_de_otro', v like '%PHOTO_PATH_FOREIGN%', v);
  v := pg_temp.run('authenticated', ub, format($q$update public.pets set photo_path = %L where id = %L returning id::text$q$, ub::text || '/propia.webp', pl));
  res := res || pg_temp.chk('H2_su_propia_carpeta_si', v = pl::text, v);
  v := pg_temp.run('authenticated', uv, format($q$update public.organization_pets set photo_path = %L where id = %L returning id::text$q$, ub::text || '/x.webp', oporg));
  res := res || pg_temp.chk('H3_organizacion_tampoco', v like '%PHOTO_PATH_FOREIGN%', v);

  update public.profiles set first_name = 'NOMBREDUENO', last_name = 'APELLIDODUENO', phone = '3001234567' where id = ub;
  update public.pets set birth_date = date '2023-03-07', description = 'descripcion publica', sex = 'female' where id = pb;
  insert into public.pet_vaccinations (pet_id, vaccine_name, application_date) values (pb, 'VACUNA-SENTINELA', current_date - 10);
  perform set_config('request.jwt.claims', json_build_object('sub', ub,'role','authenticated')::text, true);
  set local role authenticated;
  perform public.pet_medical_item_add('owner', pb, 'allergy', 'ALERGIA-SENTINELA', 'DETALLE-SENTINELA');
  reset role;
  update public.user_privacy_preferences set allow_public_phone = false where user_id = ub;
  if not found then insert into public.user_privacy_preferences (user_id, allow_public_phone) values (ub, false); end if;
  v := pg_temp.run('anon', null, format($q$select to_jsonb(g)::text from public.get_public_pet(%L) g$q$, 'zzqrtaga0004'));
  res := res || pg_temp.chk('H4_no_expone_datos_privados',
    position('NOMBREDUENO' in v) = 0 and position('APELLIDODUENO' in v) = 0 and position('zz-b@test.invalid' in v) = 0 and position('3001234567' in v) = 0
    and position('2023' in v) = 0 and position('VACUNA-SENTINELA' in v) = 0 and position('ALERGIA-SENTINELA' in v) = 0 and position('DETALLE-SENTINELA' in v) = 0
    and position(pb::text in v) = 0 and position(ub::text in v) = 0, left(v, 200));
  res := res || pg_temp.chk('H5_sin_owner_phone_sin_reporte', (v::jsonb)->>'owner_phone' is null, '');
  insert into public.pet_reports (pet_id, owner_id, kind, status, city, neighborhood) values (pb, ub, 'lost', 'active', 'Bogota', 'Centro');
  update public.pets set status = 'lost' where id = pb;
  v := pg_temp.run('anon', null, format($q$select to_jsonb(g)::text from public.get_public_pet(%L) g$q$, 'zzqrtaga0004'));
  res := res || pg_temp.chk('H6_reporte_activo_expone_report_id_pero_no_el_telefono_sin_opt_in', (v::jsonb)->>'report_id' is not null and (v::jsonb)->>'owner_phone' is null and position('3001234567' in v) = 0, left(v, 200));
  update public.user_privacy_preferences set allow_public_phone = true where user_id = ub;
  v := pg_temp.run('anon', null, format($q$select to_jsonb(g)::text from public.get_public_pet(%L) g$q$, 'zzqrtaga0004'));
  res := res || pg_temp.chk('H7_con_opt_in_y_reporte_el_telefono_si_aparece', (v::jsonb)->>'owner_phone' = '3001234567', left(v, 200));

  res := res || pg_temp.chk('G1_sin_TRUNCATE_TRIGGER_REFERENCES_en_pets',
    not has_table_privilege('authenticated', 'public.pets', 'TRUNCATE') and not has_table_privilege('authenticated', 'public.pets', 'TRIGGER')
    and not has_table_privilege('authenticated', 'public.pets', 'REFERENCES') and not has_table_privilege('anon', 'public.pets', 'TRUNCATE'), '');
  res := res || pg_temp.chk('G2_pets_conserva_CRUD_del_propietario', has_table_privilege('authenticated', 'public.pets', 'INSERT') and has_table_privilege('authenticated', 'public.pets', 'UPDATE') and has_table_privilege('authenticated', 'public.pets', 'DELETE'), '');
  res := res || pg_temp.chk('G3_dominio_qr_pedidos_envios_solo_lectura',
    (select count(*) from (values ('qr_tags'),('qr_tag_events'),('qr_batches'),('plate_orders'),('plate_order_events'),('plate_payments'),('shipments'),('shipment_events')) x(t)
      where has_table_privilege('authenticated', 'public.' || t, 'INSERT') or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
         or has_table_privilege('authenticated', 'public.' || t, 'DELETE') or has_table_privilege('anon', 'public.' || t, 'SELECT')) = 0, '');
  res := res || pg_temp.chk('G4_ninguna_tabla_publica_con_TRUNCATE_para_anon_o_authenticated',
    (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))) = 0, '');
  res := res || pg_temp.chk('G5_funciones_del_dominio_sin_EXECUTE_para_anon',
    (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
      and p.proname in ('qr_claim_tag','qr_owner_set_pet_tag_state','qr_admin_set_state','qr_admin_assign','qr_admin_replace','qr_batch_create','qr_provider_batch_create','plate_order_admin_assign_plate','shipment_admin_add_event')
      and has_function_privilege('anon', p.oid, 'EXECUTE')) = 0, '');
  res := res || pg_temp.chk('G6_todas_las_definer_con_search_path',
    (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')) = 0, '');

  raise exception E'RESULTADO\n%', res;
end $$;
