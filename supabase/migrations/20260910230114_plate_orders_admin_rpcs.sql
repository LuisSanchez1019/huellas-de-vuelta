-- Huellas de Vuelta: RPC de ADMIN para pedidos, pagos, envios y guias.
-- Todas exigen is_admin(). SECURITY DEFINER + search_path=''.

-- ---------------------------------------------------------------------------
-- Pedidos: lista (sin direccion) y detalle (con direccion, para gestionar envio)
-- ---------------------------------------------------------------------------
create or replace function public.plate_order_admin_list(
  p_status text default null, p_query text default null,
  p_limit integer default 50, p_offset integer default 0
)
returns table (
  id uuid, reference text, user_email text, pet_name text, plate_code text,
  order_status text, payment_status text, shipment_status text, tracking_number text,
  total_amount integer, currency text, city text, created_at timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  return query
  with base as (
    select o.*, u.email::text as u_email,
           coalesce(p.name, op.name) as p_name,
           t.short_code as p_code, s.status as s_status, s.tracking_number as s_track
    from public.plate_orders o
    left join auth.users u on u.id = o.user_id
    left join public.pets p on p.id = o.owner_pet_id
    left join public.organization_pets op on op.id = o.org_pet_id
    left join public.qr_tags t on t.id = o.qr_tag_id
    left join public.shipments s on s.order_id = o.id
    where (p_status is null or o.order_status = p_status)
      and (v_q is null or o.reference ilike '%'||v_q||'%'
           or u.email ilike '%'||v_q||'%'
           or coalesce(p.name, op.name, '') ilike '%'||v_q||'%'
           or s.tracking_number ilike '%'||v_q||'%')
  )
  select base.id, base.reference, base.u_email, base.p_name, base.p_code,
         base.order_status, base.payment_status, base.s_status, base.s_track,
         base.total_amount, base.currency, base.city, base.created_at,
         count(*) over ()
  from base order by base.created_at desc
  limit v_limit offset v_offset;
end;
$$;
revoke all on function public.plate_order_admin_list(text, text, integer, integer) from public, anon;
grant execute on function public.plate_order_admin_list(text, text, integer, integer) to authenticated;

create or replace function public.plate_order_admin_detail(p_order_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  select jsonb_build_object(
    'id', o.id, 'reference', o.reference, 'user_email', u.email::text,
    'pet_kind', case when o.owner_pet_id is not null then 'owner' else 'org' end,
    'pet_id', coalesce(o.owner_pet_id, o.org_pet_id),
    'pet_name', coalesce(p.name, op.name),
    'pet_public_id', coalesce(p.public_id, op.public_id),
    'qr_tag_id', o.qr_tag_id, 'plate_code', t.short_code, 'plate_status', t.status,
    'order_status', o.order_status, 'payment_status', o.payment_status,
    'product_amount', o.product_amount, 'shipping_amount', o.shipping_amount,
    'total_amount', o.total_amount, 'currency', o.currency,
    'zone', z.name,
    'recipient_first_name', o.recipient_first_name, 'recipient_last_name', o.recipient_last_name,
    'city', o.city, 'neighborhood', o.neighborhood, 'address', o.address,
    'phone', o.phone, 'email', o.email, 'created_at', o.created_at,
    'shipment', case when s.id is null then null else jsonb_build_object(
      'id', s.id, 'tracking_number', s.tracking_number, 'carrier', s.carrier,
      'service', s.service, 'status', s.status,
      'shipped_at', s.shipped_at, 'delivered_at', s.delivered_at) end,
    'shipment_events', coalesce((select jsonb_agg(jsonb_build_object(
        'status', e.status, 'description', e.description, 'created_at', e.created_at) order by e.created_at)
      from public.shipment_events e where e.shipment_id = s.id), '[]'::jsonb),
    'order_events', coalesce((select jsonb_agg(jsonb_build_object(
        'event', ev.event, 'note', ev.note, 'created_at', ev.created_at) order by ev.created_at)
      from public.plate_order_events ev where ev.order_id = o.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'method', pm.method, 'amount', pm.amount, 'status', pm.status,
        'provider_reference', pm.provider_reference, 'created_at', pm.created_at) order by pm.created_at)
      from public.plate_payments pm where pm.order_id = o.id), '[]'::jsonb)
  ) into v_result
  from public.plate_orders o
  left join auth.users u on u.id = o.user_id
  left join public.pets p on p.id = o.owner_pet_id
  left join public.organization_pets op on op.id = o.org_pet_id
  left join public.qr_tags t on t.id = o.qr_tag_id
  left join public.shipping_zones z on z.id = o.shipping_zone_id
  left join public.shipments s on s.order_id = o.id
  where o.id = p_order_id;
  if v_result is null then raise exception 'Pedido no encontrado.'; end if;
  return v_result;
end;
$$;
revoke all on function public.plate_order_admin_detail(uuid) from public, anon;
grant execute on function public.plate_order_admin_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pago (sin pasarela real): el admin marca el estado.
-- ---------------------------------------------------------------------------
create or replace function public.plate_payment_admin_set_status(
  p_order_id uuid, p_status text, p_method text default null, p_provider_reference text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pay uuid; v_ostatus text;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  if p_status not in ('pending','approved','rejected','cancelled','refunded') then
    raise exception 'Estado de pago no valido.';
  end if;
  select order_status into v_ostatus from public.plate_orders where id = p_order_id for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;

  select id into v_pay from public.plate_payments where order_id = p_order_id
    order by created_at desc limit 1;
  update public.plate_payments
    set status = p_status,
        method = coalesce(nullif(btrim(coalesce(p_method, '')), ''), method),
        provider_reference = nullif(left(btrim(coalesce(p_provider_reference, '')), 120), '')
  where id = v_pay;

  update public.plate_orders set payment_status = p_status where id = p_order_id;

  if p_status = 'approved' then
    insert into public.plate_order_events (order_id, event, actor_id) values (p_order_id, 'payment_approved', v_uid);
    if v_ostatus = 'pending' then
      update public.plate_orders set order_status = 'confirmed' where id = p_order_id;
      insert into public.plate_order_events (order_id, event, actor_id) values (p_order_id, 'confirmed', v_uid);
    end if;
  elsif p_status = 'rejected' then
    insert into public.plate_order_events (order_id, event, actor_id) values (p_order_id, 'payment_rejected', v_uid);
  elsif p_status = 'refunded' then
    insert into public.plate_order_events (order_id, event, actor_id) values (p_order_id, 'payment_refunded', v_uid);
  end if;
end;
$$;
revoke all on function public.plate_payment_admin_set_status(uuid, text, text, text) from public, anon;
grant execute on function public.plate_payment_admin_set_status(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Asignar una placa disponible al pedido (queda 'assigned', aun no 'active').
-- ---------------------------------------------------------------------------
create or replace function public.plate_order_admin_assign_plate(p_order_id uuid, p_tag_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner_pet uuid; v_org_pet uuid; v_pay text; v_qr uuid; v_tstatus text;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;

  select owner_pet_id, org_pet_id, payment_status, qr_tag_id
    into v_owner_pet, v_org_pet, v_pay, v_qr
  from public.plate_orders where id = p_order_id for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_qr is not null then raise exception 'El pedido ya tiene una placa asignada.'; end if;
  if v_pay <> 'approved' then raise exception 'El pago del pedido aun no esta aprobado.'; end if;

  select status into v_tstatus from public.qr_tags where id = p_tag_id for update;
  if not found then raise exception 'La placa no existe.'; end if;
  if v_tstatus <> 'available' then raise exception 'La placa no esta disponible.'; end if;

  if exists (select 1 from public.qr_tags
             where status in ('assigned','active','suspended')
               and (owner_pet_id = coalesce(v_owner_pet, v_org_pet)
                    or org_pet_id = coalesce(v_owner_pet, v_org_pet))) then
    raise exception 'Esa mascota ya tiene una placa vinculada.';
  end if;

  update public.qr_tags
    set owner_pet_id = v_owner_pet, org_pet_id = v_org_pet,
        status = 'assigned', assigned_at = now()
  where id = p_tag_id;
  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id)
  select p_tag_id, batch_id, 'assigned', v_uid, v_owner_pet, v_org_pet
  from public.qr_tags where id = p_tag_id;

  update public.plate_orders set qr_tag_id = p_tag_id, order_status = 'preparing' where id = p_order_id;
  insert into public.plate_order_events (order_id, event, actor_id) values (p_order_id, 'plate_assigned', v_uid);
  insert into public.plate_order_events (order_id, event, actor_id) values (p_order_id, 'preparing', v_uid);
end;
$$;
revoke all on function public.plate_order_admin_assign_plate(uuid, uuid) from public, anon;
grant execute on function public.plate_order_admin_assign_plate(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Crear el envio -> genera la GUIA.
-- ---------------------------------------------------------------------------
create or replace function public.shipment_admin_create(
  p_order_id uuid, p_carrier text default null, p_service text default null
)
returns table (shipment_id uuid, tracking_number text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_qr uuid; v_ostatus text; v_track text; v_ship uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  select qr_tag_id, order_status into v_qr, v_ostatus
  from public.plate_orders where id = p_order_id for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_qr is null then raise exception 'Asigna una placa al pedido antes de crear el envio.'; end if;
  if v_ostatus not in ('preparing','ready_to_ship') then
    raise exception 'El pedido no esta listo para envio (estado: %).', v_ostatus;
  end if;
  if exists (select 1 from public.shipments where order_id = p_order_id) then
    raise exception 'Este pedido ya tiene un envio.';
  end if;

  v_track := public._gen_tracking_number();
  insert into public.shipments (order_id, tracking_number, carrier, service, status)
  values (p_order_id, v_track,
          nullif(left(btrim(coalesce(p_carrier, '')), 60), ''),
          nullif(left(btrim(coalesce(p_service, '')), 60), ''),
          'preparing')
  returning id into v_ship;

  insert into public.shipment_events (shipment_id, status, description, created_by)
  values (v_ship, 'CREATED', 'Envio creado y guia generada', v_uid);

  update public.plate_orders set order_status = 'ready_to_ship' where id = p_order_id;
  insert into public.plate_order_events (order_id, event, actor_id) values (p_order_id, 'ready_to_ship', v_uid);

  return query select v_ship, v_track;
end;
$$;
revoke all on function public.shipment_admin_create(uuid, text, text) from public, anon;
grant execute on function public.shipment_admin_create(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Añadir evento de envio -> sincroniza estado de envio, pedido y placa.
-- ---------------------------------------------------------------------------
create or replace function public.shipment_admin_add_event(
  p_shipment_id uuid, p_status text, p_description text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order uuid; v_qr uuid; v_owner_pet uuid; v_org_pet uuid; v_desc text;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  if p_status not in ('CREATED','PREPARED','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION','CANCELLED') then
    raise exception 'Estado de envio no valido.';
  end if;
  select s.order_id, o.qr_tag_id, o.owner_pet_id, o.org_pet_id
    into v_order, v_qr, v_owner_pet, v_org_pet
  from public.shipments s join public.plate_orders o on o.id = s.order_id
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
    update public.shipments set status = 'delivered', delivered_at = coalesce(delivered_at, now()) where id = p_shipment_id;
    update public.plate_orders set order_status = 'delivered' where id = v_order;
    insert into public.plate_order_events (order_id, event, actor_id) values (v_order, 'delivered', v_uid);
    -- La placa identifica a la mascota al ser recibida.
    if v_qr is not null then
      update public.qr_tags set status = 'active' where id = v_qr and status = 'assigned';
      insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id)
      select v_qr, batch_id, 'activated', v_uid, v_owner_pet, v_org_pet from public.qr_tags where id = v_qr;
    end if;
  elsif p_status = 'EXCEPTION' then
    update public.shipments set status = 'exception' where id = p_shipment_id;
  elsif p_status = 'CANCELLED' then
    update public.shipments set status = 'cancelled' where id = p_shipment_id;
  end if;
end;
$$;
revoke all on function public.shipment_admin_add_event(uuid, text, text) from public, anon;
grant execute on function public.shipment_admin_add_event(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Lista de envios (para /admin/envios)
-- ---------------------------------------------------------------------------
create or replace function public.shipment_admin_list(p_status text default null)
returns table (
  id uuid, order_reference text, tracking_number text, carrier text, service text,
  status text, pet_name text, city text, user_email text,
  shipped_at timestamptz, delivered_at timestamptz, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  return query
  select s.id, o.reference, s.tracking_number, s.carrier, s.service, s.status,
         coalesce(p.name, op.name), o.city, u.email::text,
         s.shipped_at, s.delivered_at, s.created_at
  from public.shipments s
  join public.plate_orders o on o.id = s.order_id
  left join auth.users u on u.id = o.user_id
  left join public.pets p on p.id = o.owner_pet_id
  left join public.organization_pets op on op.id = o.org_pet_id
  where (p_status is null or s.status = p_status)
  order by s.created_at desc;
end;
$$;
revoke all on function public.shipment_admin_list(text) from public, anon;
grant execute on function public.shipment_admin_list(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Config de tarifas (admin)
-- ---------------------------------------------------------------------------
create or replace function public.shipping_admin_list()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  select jsonb_build_object(
    'zones', coalesce((select jsonb_agg(jsonb_build_object(
      'id', z.id, 'name', z.name, 'is_default', z.is_default, 'active', z.active,
      'rate', (select jsonb_build_object('product_amount', r.product_amount,
        'shipping_amount', r.shipping_amount, 'currency', r.currency, 'note', r.note)
        from public.shipping_rates r where r.zone_id = z.id and r.active)
    ) order by z.sort_order) from public.shipping_zones z), '[]'::jsonb),
    'cities', coalesce((select jsonb_agg(jsonb_build_object('city_norm', cz.city_norm, 'zone_id', cz.zone_id)
      order by cz.city_norm) from public.shipping_city_zones cz), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
revoke all on function public.shipping_admin_list() from public, anon;
grant execute on function public.shipping_admin_list() to authenticated;

create or replace function public.shipping_admin_set_rate(
  p_zone_id uuid, p_product_amount integer, p_shipping_amount integer, p_note text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  if p_product_amount < 0 or p_shipping_amount < 0 then raise exception 'Los importes no pueden ser negativos.'; end if;
  if not exists (select 1 from public.shipping_zones where id = p_zone_id) then raise exception 'Zona no encontrada.'; end if;
  update public.shipping_rates set active = false where zone_id = p_zone_id and active;
  insert into public.shipping_rates (zone_id, product_amount, shipping_amount, note)
  values (p_zone_id, p_product_amount, p_shipping_amount, nullif(left(btrim(coalesce(p_note, '')), 200), ''));
end;
$$;
revoke all on function public.shipping_admin_set_rate(uuid, integer, integer, text) from public, anon;
grant execute on function public.shipping_admin_set_rate(uuid, integer, integer, text) to authenticated;
