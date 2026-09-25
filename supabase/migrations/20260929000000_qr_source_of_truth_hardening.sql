-- Huellas de Vuelta como FUENTE DE VERDAD de QR <-> mascota (bloque de cierre estructural).
--
-- 1. Identidad publica unica: `public_id` inmutable y sin colisiones entre pets / organization_pets / qr_tags.
-- 2. get_public_pet: el QR activo es la unica resolucion valida de un QR; las mascotas solo se resuelven
--    por su id "de campana" cuando estan publicadas (perdida / encontrada / adopcion). Una placa
--    suspendida, reemplazada, anulada o liberada ya NO deja el perfil accesible por otro camino.
--    La foto solo viaja si es realmente publica.
-- 3. qr_claim_tag: solo cuentas de usuario final (no proveedor / organizaciones); una mascota con placa
--    SUSPENDIDA la reemplaza (la anterior queda `replaced`).
-- 4. qr_owner_set_pet_tag_state: el propietario suspende / reactiva su propia placa.
-- 5. La entrega ya no activa el QR, y el pedido ya no vincula la mascota (solo reserva la placa).
-- 6. Eliminar una mascota ANULA su placa (antes quedaba `available`, reclamable por cualquiera).
-- 7. Privilegios minimos: sin TRUNCATE / TRIGGER / REFERENCES / MAINTAIN para anon y authenticated, y
--    escrituras del dominio QR / pedidos / envios solo por RPC.
-- 8. Los eventos del QR ya no impiden borrar la cuenta de quien los genero (actor_id ON DELETE SET NULL).

-- ============================================================ 1. Identidad publica unica

create or replace function public._public_id_in_use(p_id text, p_skip_table text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_skip_table is distinct from 'pets'
            and exists (select 1 from public.pets where public_id in (p_id, lower(p_id))))
      or (p_skip_table is distinct from 'organization_pets'
            and exists (select 1 from public.organization_pets where public_id in (p_id, lower(p_id))))
      or (p_skip_table is distinct from 'qr_tags'
            and exists (select 1 from public.qr_tags where public_id in (p_id, lower(p_id))));
$$;
revoke all on function public._public_id_in_use(text, text) from public, anon, authenticated;

-- pets / organization_pets: el cliente nunca elige ni cambia su identificador publico.
create or replace function public.guard_entity_public_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client boolean := (select auth.uid()) is not null;
  v_tries integer := 0;
begin
  if tg_op = 'UPDATE' then
    if new.public_id is distinct from old.public_id then
      if v_client then
        raise exception 'PUBLIC_ID_IMMUTABLE';
      end if;
      if public._public_id_in_use(new.public_id, tg_table_name) then
        raise exception 'PUBLIC_ID_COLLISION';
      end if;
    end if;
    return new;
  end if;

  if v_client or new.public_id is null then
    new.public_id := public.gen_pet_public_id();
  end if;
  while public._public_id_in_use(new.public_id, tg_table_name) loop
    v_tries := v_tries + 1;
    if v_tries > 5 then
      raise exception 'PUBLIC_ID_COLLISION';
    end if;
    new.public_id := public.gen_pet_public_id();
  end loop;
  return new;
end;
$$;
revoke all on function public.guard_entity_public_id() from public, anon, authenticated;

-- qr_tags: el id impreso en la placa fisica no cambia nunca (salvo reparacion por SQL sin sesion).
create or replace function public.guard_qr_tag_public_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.public_id is distinct from old.public_id then
      if (select auth.uid()) is not null then
        raise exception 'PUBLIC_ID_IMMUTABLE';
      end if;
      if public._public_id_in_use(new.public_id, 'qr_tags') then
        raise exception 'PUBLIC_ID_COLLISION';
      end if;
    end if;
    return new;
  end if;
  if public._public_id_in_use(new.public_id, 'qr_tags') then
    raise exception 'PUBLIC_ID_COLLISION';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_qr_tag_public_id() from public, anon, authenticated;

drop trigger if exists pets_guard_public_id on public.pets;
create trigger pets_guard_public_id
  before insert or update of public_id on public.pets
  for each row execute function public.guard_entity_public_id();

drop trigger if exists organization_pets_guard_public_id on public.organization_pets;
create trigger organization_pets_guard_public_id
  before insert or update of public_id on public.organization_pets
  for each row execute function public.guard_entity_public_id();

drop trigger if exists qr_tags_guard_public_id on public.qr_tags;
create trigger qr_tags_guard_public_id
  before insert or update of public_id on public.qr_tags
  for each row execute function public.guard_qr_tag_public_id();

-- ============================================================ 2. Perfil publico

create or replace function public.get_public_pet(p_public_id text)
returns table(
  public_id text, name text, species text, species_other text, breed text,
  color_primary text, color_secondary text, color_tertiary text,
  age_value integer, age_unit text, age_text text, sex text, description text,
  status text, photo_path text,
  report_id uuid, report_stage text, lost_city text, lost_neighborhood text, lost_details text,
  reported_at timestamptz, plate_code text, source_kind text, tag_state text,
  medical_alert boolean, medical_urgent boolean, owner_phone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tag_public text;
  v_tag_status text;
  v_tag_owner_pet uuid;
  v_tag_org_pet uuid;
  v_plate text := null;
  v_had_tag boolean := false;
begin
  select t.public_id, t.status, t.owner_pet_id, t.org_pet_id, t.short_code
    into v_tag_public, v_tag_status, v_tag_owner_pet, v_tag_org_pet, v_plate
  from public.qr_tags t
  where t.public_id = p_public_id;
  v_had_tag := found;

  -- 1) QR ACTIVO: unica resolucion valida del QR fisico. Devuelve el id DEL QR (no el de la mascota).
  if v_had_tag and v_tag_status = 'active' then
    if v_tag_owner_pet is not null then
      return query
      select v_tag_public, p.name, p.species, p.species_other, p.breed,
             p.color_primary, p.color_secondary, p.color_tertiary,
             public._pet_age_value(p.birth_date, p.age_value, p.age_unit),
             public._pet_age_unit(p.birth_date, p.age_value, p.age_unit),
             null::text, p.sex, p.description,
             p.status::text,
             case when public.is_public_pet_photo(p.photo_path) then p.photo_path else null end,
             r.id, r.stage, r.city, r.neighborhood, r.details, r.created_at,
             v_plate, 'owner'::text, 'active'::text,
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
      where p.id = v_tag_owner_pet and not p.is_archived;
    elsif v_tag_org_pet is not null then
      return query
      select v_tag_public, op.name, op.species, op.species_other, op.breed,
             null::text, null::text, null::text,
             null::integer, null::text, op.age, op.sex, null::text,
             (case when op.needs_home or op.needs_sponsor then 'for_adoption' else 'at_home' end),
             case when public.is_public_pet_photo(op.photo_path) then op.photo_path else null end,
             null::uuid, null::text, null::text, null::text, null::text, null::timestamptz,
             v_plate, 'org'::text, 'active'::text,
             coalesce(s.public_alert_enabled
                      and (s.has_condition or s.has_allergy or s.has_medication or s.has_urgent), false),
             coalesce(s.public_alert_enabled and s.public_urgent_enabled and s.has_urgent, false),
             null::text
      from public.organization_pets op
      left join public.pet_medical_summary s on s.org_pet_id = op.id
      where op.id = v_tag_org_pet;
    end if;
    return;
  end if;

  -- 2) CAMPANA PUBLICA: mascota que su dueno/organizacion publico (perdida, encontrada, en adopcion).
  --    Es independiente del QR y solo se resuelve por su id de campana, nunca por el id de un QR
  --    suspendido, reemplazado, anulado o disponible (salvo placas heredadas que compartian id).
  return query
  select p.public_id, p.name, p.species, p.species_other, p.breed,
         p.color_primary, p.color_secondary, p.color_tertiary,
         public._pet_age_value(p.birth_date, p.age_value, p.age_unit),
         public._pet_age_unit(p.birth_date, p.age_value, p.age_unit),
         null::text, p.sex, p.description,
         p.status::text,
         case when public.is_public_pet_photo(p.photo_path) then p.photo_path else null end,
         r.id, r.stage, r.city, r.neighborhood, r.details, r.created_at,
         v_plate, 'owner'::text, 'legacy'::text,
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
  where p.public_id = p_public_id
    and p.status in ('lost', 'found', 'for_adoption')
    and not p.is_archived;
  if found then
    return;
  end if;

  return query
  select op.public_id, op.name, op.species, op.species_other, op.breed,
         null::text, null::text, null::text,
         null::integer, null::text, op.age, op.sex, null::text,
         'for_adoption'::text,
         case when public.is_public_pet_photo(op.photo_path) then op.photo_path else null end,
         null::uuid, null::text, null::text, null::text, null::text, null::timestamptz,
         v_plate, 'org'::text, 'legacy'::text,
         coalesce(s.public_alert_enabled
                  and (s.has_condition or s.has_allergy or s.has_medication or s.has_urgent), false),
         coalesce(s.public_alert_enabled and s.public_urgent_enabled and s.has_urgent, false),
         null::text
  from public.organization_pets op
  left join public.pet_medical_summary s on s.org_pet_id = op.id
  where op.public_id = p_public_id
    and (op.needs_home or op.needs_sponsor);
  if found then
    return;
  end if;

  -- 3) QR que existe pero NO esta activo: solo se informa su estado (sin datos de ninguna mascota).
  if v_had_tag then
    return query
    select p_public_id, null::text, null::text, null::text, null::text,
           null::text, null::text, null::text,
           null::integer, null::text, null::text, null::text, null::text,
           null::text, null::text,
           null::uuid, null::text, null::text, null::text, null::text, null::timestamptz,
           v_plate, null::text, v_tag_status,
           false, false, null::text;
  end if;
end;
$$;

-- ============================================================ 3. Claim del propietario

create or replace function public.qr_claim_tag(p_public_id text, p_pet_id uuid)
returns table(short_code text, tag_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_pet_archived boolean;
  v_tag_id uuid;
  v_current_status text;
  v_short_code text;
  v_batch_id uuid;
  v_old_id uuid;
  v_old_status text;
  v_old_batch uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- El claim pertenece al usuario final: ni el proveedor ni las organizaciones activan placas.
  select pr.role::text into v_role from public.profiles pr where pr.id = v_uid;
  if v_role is null or v_role not in ('usuario', 'aliado') then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;

  -- Propiedad real de la mascota: SOLO auth.uid(), nunca un parametro del cliente.
  select p.is_archived into v_pet_archived
  from public.pets p
  where p.id = p_pet_id and p.owner_id = v_uid;
  if not found then
    raise exception 'PET_NOT_FOUND';
  end if;
  if v_pet_archived then
    raise exception 'PET_ARCHIVED';
  end if;

  -- Bloquea la fila de la placa: una llamada concurrente sobre la MISMA placa espera aqui y,
  -- al continuar, ya ve el estado actualizado.
  select t.id, t.status, t.short_code, t.batch_id
    into v_tag_id, v_current_status, v_short_code, v_batch_id
  from public.qr_tags t
  where t.public_id = p_public_id
  for update;
  if not found then
    raise exception 'TAG_NOT_FOUND';
  end if;

  if v_current_status <> 'available' then
    case v_current_status
      when 'assigned'  then raise exception 'TAG_ALREADY_ASSIGNED';
      when 'active'    then raise exception 'TAG_ALREADY_ACTIVE';
      when 'suspended' then raise exception 'TAG_SUSPENDED';
      when 'replaced'  then raise exception 'TAG_REPLACED';
      when 'annulled'  then raise exception 'TAG_ANNULLED';
      else raise exception 'TAG_NOT_AVAILABLE';
    end case;
  end if;

  -- Placa viva anterior de la misma mascota: solo una SUSPENDIDA (el propietario declaro perdida
  -- o dañada la anterior) se reemplaza; una activa exige suspenderla primero.
  select t.id, t.status, t.batch_id into v_old_id, v_old_status, v_old_batch
  from public.qr_tags t
  where t.owner_pet_id = p_pet_id and t.status in ('assigned', 'active', 'suspended')
  for update;
  if found then
    if v_old_status <> 'suspended' then
      raise exception 'PET_ALREADY_HAS_TAG';
    end if;
    update public.qr_tags set status = 'replaced', replaced_by_tag_id = v_tag_id where id = v_old_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, reason)
    values (v_old_id, v_old_batch, 'replaced', v_uid, p_pet_id, 'Reemplazada por el propietario con una placa nueva');
  end if;

  update public.qr_tags
    set owner_pet_id = p_pet_id, status = 'active', assigned_at = now()
  where id = v_tag_id;

  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id)
  values (v_tag_id, v_batch_id, 'assigned', v_uid, p_pet_id);
  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id)
  values (v_tag_id, v_batch_id, 'activated', v_uid, p_pet_id);

  short_code := v_short_code;
  tag_status := 'active';
  return next;
exception
  -- Carrera real entre dos placas distintas para la misma mascota: la garantia final es el indice
  -- unico parcial `qr_tags_one_live_per_owner_pet`, no esta funcion.
  when unique_violation then
    raise exception 'PET_ALREADY_HAS_TAG';
end;
$$;
revoke all on function public.qr_claim_tag(text, uuid) from public, anon;
grant execute on function public.qr_claim_tag(text, uuid) to authenticated;

-- ============================================================ 4. Suspender / reactivar la propia placa

create or replace function public.qr_owner_set_pet_tag_state(p_pet_id uuid, p_action text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_tag_id uuid;
  v_status text;
  v_batch uuid;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
  v_last_actor uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select pr.role::text into v_role from public.profiles pr where pr.id = v_uid;
  if v_role is null or v_role not in ('usuario', 'aliado') then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;
  if p_action not in ('suspend', 'resume') then
    raise exception 'INVALID_ACTION';
  end if;
  if not exists (select 1 from public.pets p where p.id = p_pet_id and p.owner_id = v_uid) then
    raise exception 'PET_NOT_FOUND';
  end if;

  select t.id, t.status, t.batch_id into v_tag_id, v_status, v_batch
  from public.qr_tags t
  where t.owner_pet_id = p_pet_id and t.status in ('active', 'suspended')
  for update;
  if not found then
    raise exception 'TAG_NOT_FOUND';
  end if;

  if p_action = 'suspend' then
    if v_status <> 'active' then
      raise exception 'TAG_NOT_ACTIVE';
    end if;
    update public.qr_tags set status = 'suspended' where id = v_tag_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, reason)
    values (v_tag_id, v_batch, 'suspended', v_uid, p_pet_id, coalesce(v_reason, 'Suspendida por el propietario'));
  else
    if v_status <> 'suspended' then
      raise exception 'TAG_NOT_SUSPENDED';
    end if;
    -- Solo se reactiva una suspension hecha por el propio propietario; la del administrador no.
    select e.actor_id into v_last_actor
    from public.qr_tag_events e
    where e.tag_id = v_tag_id and e.event = 'suspended'
    order by e.created_at desc, e.id desc
    limit 1;
    if v_last_actor is distinct from v_uid then
      raise exception 'TAG_SUSPENDED_BY_ADMIN';
    end if;
    update public.qr_tags set status = 'active' where id = v_tag_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, reason)
    values (v_tag_id, v_batch, 'resumed', v_uid, p_pet_id, coalesce(v_reason, 'Reactivada por el propietario'));
  end if;
end;
$$;
revoke all on function public.qr_owner_set_pet_tag_state(uuid, text, text) from public, anon;
grant execute on function public.qr_owner_set_pet_tag_state(uuid, text, text) to authenticated;

-- ============================================================ 5. Entrega / pedido no activan ni vinculan

create or replace function public.plate_order_admin_assign_plate(p_order_id uuid, p_tag_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pay text; v_qr uuid; v_tstatus text;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;

  select payment_status, qr_tag_id into v_pay, v_qr
  from public.plate_orders where id = p_order_id for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_qr is not null then raise exception 'El pedido ya tiene una placa asignada.'; end if;
  if v_pay <> 'approved' then raise exception 'El pago del pedido aun no esta aprobado.'; end if;

  select status into v_tstatus from public.qr_tags where id = p_tag_id for update;
  if not found then raise exception 'La placa no existe.'; end if;
  if v_tstatus <> 'available' then raise exception 'La placa no esta disponible.'; end if;
  if exists (select 1 from public.plate_orders
             where qr_tag_id = p_tag_id and order_status <> 'cancelled') then
    raise exception 'La placa ya esta reservada por otro pedido.';
  end if;

  -- La placa SOLO se reserva para el pedido: el QR sigue `available` y no se vincula a ninguna
  -- mascota. La vinculacion la hace el propietario con qr_claim_tag al recibirla.
  update public.plate_orders set qr_tag_id = p_tag_id, order_status = 'preparing' where id = p_order_id;
  insert into public.plate_order_events (order_id, event, actor_id) values (p_order_id, 'plate_assigned', v_uid);
  insert into public.plate_order_events (order_id, event, actor_id) values (p_order_id, 'preparing', v_uid);
end;
$$;

create or replace function public.shipment_admin_add_event(p_shipment_id uuid, p_status text, p_description text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order uuid; v_desc text;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  if p_status not in ('CREATED','PREPARED','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION','CANCELLED') then
    raise exception 'Estado de envio no valido.';
  end if;
  select s.order_id into v_order
  from public.shipments s
  where s.id = p_shipment_id for update;
  if not found then raise exception 'Envio no encontrado.'; end if;
  v_desc := nullif(left(btrim(coalesce(p_description, '')), 300), '');

  insert into public.shipment_events (shipment_id, status, description, created_by)
  values (p_shipment_id, p_status, v_desc, v_uid);

  if p_status = 'PREPARED' then
    update public.shipments set status = 'preparing' where id = p_shipment_id;
  elsif p_status = 'SHIPPED' then
    update public.shipments set status = 'shipped', shipped_at = coalesce(shipped_at, now()) where id = p_shipment_id;
    update public.plate_orders set order_status = 'shipped' where id = v_order;
    insert into public.plate_order_events (order_id, event, actor_id) values (v_order, 'shipped', v_uid);
  elsif p_status = 'IN_TRANSIT' then
    update public.shipments set status = 'in_transit' where id = p_shipment_id;
  elsif p_status = 'OUT_FOR_DELIVERY' then
    update public.shipments set status = 'out_for_delivery' where id = p_shipment_id;
  elsif p_status = 'DELIVERED' then
    -- Entregar NO activa el QR: el propietario lo vincula con qr_claim_tag.
    update public.shipments set status = 'delivered', delivered_at = coalesce(delivered_at, now()) where id = p_shipment_id;
    update public.plate_orders set order_status = 'delivered' where id = v_order;
    insert into public.plate_order_events (order_id, event, actor_id) values (v_order, 'delivered', v_uid);
  elsif p_status = 'EXCEPTION' then
    update public.shipments set status = 'exception' where id = p_shipment_id;
  elsif p_status = 'CANCELLED' then
    update public.shipments set status = 'cancelled' where id = p_shipment_id;
  end if;
end;
$$;

-- ============================================================ 6. Eliminar mascota => placa ANULADA

create or replace function public._pets_release_qr_tags_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with annulled as (
    update public.qr_tags t
       set status = 'annulled'
     where t.owner_pet_id = old.id
       and t.status in ('assigned', 'active', 'suspended')
    returning t.id, t.batch_id
  )
  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, reason)
  select a.id, a.batch_id, 'annulled', null, old.id, 'Mascota eliminada por su propietario: la placa queda anulada'
  from annulled a;
  return old;
end;
$$;

-- ============================================================ 8. Eventos vs. borrado de cuenta

alter table public.qr_tag_events drop constraint if exists qr_tag_events_actor_id_fkey;
alter table public.qr_tag_events
  add constraint qr_tag_events_actor_id_fkey foreign key (actor_id) references public.profiles(id) on delete set null;
alter table public.qr_batches drop constraint if exists qr_batches_created_by_fkey;
alter table public.qr_batches
  add constraint qr_batches_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

-- ============================================================ 7. Privilegios minimos

revoke truncate, trigger, references, maintain on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables from anon, authenticated;

-- Dominio QR / pedidos / envios: solo lectura filtrada por RLS para authenticated; nada para anon.
-- Toda escritura pasa por RPC SECURITY DEFINER.
revoke all on
  public.qr_tags, public.qr_tag_events, public.qr_batches, public.qr_code_counters,
  public.plate_orders, public.plate_order_events, public.plate_payments, public.plate_order_year_counters,
  public.shipments, public.shipment_events, public.shipment_year_counters
from anon;
revoke insert, update, delete on
  public.qr_tags, public.qr_tag_events, public.qr_batches, public.qr_code_counters,
  public.plate_orders, public.plate_order_events, public.plate_payments, public.plate_order_year_counters,
  public.shipments, public.shipment_events, public.shipment_year_counters
from authenticated;

revoke execute on function public.gen_pet_public_id() from anon;
