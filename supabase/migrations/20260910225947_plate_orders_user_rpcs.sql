-- Huellas de Vuelta: RPC de USUARIO para el flujo de solicitud de placa.
-- SECURITY DEFINER + search_path=''. La identidad SIEMPRE es auth.uid(); el
-- frontend nunca envia user_id, pet ajeno, ni importes.

-- ---------------------------------------------------------------------------
-- Selector "Mascota asignada": solo las mascotas del usuario autenticado.
-- ---------------------------------------------------------------------------
create or replace function public.my_pets_for_plate()
returns table (
  pet_kind text, pet_id uuid, name text, species text,
  plate_code text, plate_status text,
  active_order_ref text, active_order_status text,
  eligible boolean, reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return query
  select 'owner'::text, p.id, p.name, p.species::text,
    lt.short_code, lt.status,
    ao.reference, ao.order_status,
    (lt.id is null and ao.id is null),
    case
      when lt.id is not null and lt.status = 'active' then 'Esta mascota ya tiene una placa activa.'
      when lt.id is not null then 'Esta mascota ya tiene una placa vinculada.'
      when ao.id is not null then 'Ya tienes una solicitud de placa para esta mascota.'
      else null
    end
  from public.pets p
  left join public.qr_tags lt
    on lt.owner_pet_id = p.id and lt.status in ('assigned','active','suspended')
  left join public.plate_orders ao
    on ao.owner_pet_id = p.id and ao.order_status not in ('cancelled','delivered')
  where p.owner_id = v_uid and not p.is_archived
  order by p.created_at;
end;
$$;
revoke all on function public.my_pets_for_plate() from public, anon;
grant execute on function public.my_pets_for_plate() to authenticated;

-- ---------------------------------------------------------------------------
-- Cotizacion: el backend determina zona, tarifa y total.
-- ---------------------------------------------------------------------------
create or replace function public.plate_order_quote(p_pet_kind text, p_pet_id uuid, p_city text)
returns table (zone_id uuid, zone_name text, product_amount integer, shipping_amount integer, total_amount integer, currency text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_zone uuid;
  v_norm text := public._shipping_norm(p_city);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_pet_kind <> 'owner' then raise exception 'Solo disponible para mascotas propias en esta etapa.'; end if;
  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = v_uid and not is_archived) then
    raise exception 'La mascota no es tuya o no existe.';
  end if;

  select z.id into v_zone
  from public.shipping_city_zones cz join public.shipping_zones z on z.id = cz.zone_id
  where cz.city_norm = v_norm and z.active;
  if v_zone is null then
    select id into v_zone from public.shipping_zones where is_default and active;
  end if;
  if v_zone is null then raise exception 'No hay tarifas de envio configuradas.'; end if;

  return query
  select z.id, z.name, r.product_amount, r.shipping_amount,
         r.product_amount + r.shipping_amount, r.currency
  from public.shipping_zones z
  join public.shipping_rates r on r.zone_id = z.id and r.active
  where z.id = v_zone;
end;
$$;
revoke all on function public.plate_order_quote(text, uuid, text) from public, anon;
grant execute on function public.plate_order_quote(text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Crear el pedido. Los importes NO se aceptan del frontend: se recalculan.
-- ---------------------------------------------------------------------------
create or replace function public.plate_order_create(
  p_pet_kind text, p_pet_id uuid,
  p_first text, p_last text, p_city text, p_neighborhood text, p_address text,
  p_phone text, p_email text, p_use_account_email boolean default true
)
returns table (order_id uuid, reference text, total_amount integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_first text; v_last text; v_city text; v_nb text; v_addr text; v_phone text;
  v_zone uuid; v_prod integer; v_ship integer; v_curr text;
  v_year integer := extract(year from now())::integer;
  v_seq integer; v_ref text; v_order uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_pet_kind <> 'owner' then raise exception 'Solo disponible para mascotas propias en esta etapa.'; end if;

  if not exists (select 1 from public.pets where id = p_pet_id and owner_id = v_uid and not is_archived) then
    raise exception 'La mascota no es tuya o no existe.';
  end if;
  if exists (select 1 from public.qr_tags where owner_pet_id = p_pet_id and status in ('assigned','active','suspended')) then
    raise exception 'Esta mascota ya tiene una placa vinculada.';
  end if;
  if exists (select 1 from public.plate_orders where owner_pet_id = p_pet_id and order_status not in ('cancelled','delivered')) then
    raise exception 'Ya tienes una solicitud de placa activa para esta mascota.';
  end if;

  v_first := btrim(regexp_replace(coalesce(p_first, ''), '[\x00-\x1F\x7F]', '', 'g'));
  v_last  := btrim(regexp_replace(coalesce(p_last, ''),  '[\x00-\x1F\x7F]', '', 'g'));
  v_city  := btrim(regexp_replace(coalesce(p_city, ''),  '[\x00-\x1F\x7F]', '', 'g'));
  v_nb    := btrim(regexp_replace(coalesce(p_neighborhood, ''), '[\x00-\x1F\x7F]', '', 'g'));
  v_addr  := btrim(regexp_replace(coalesce(p_address, ''), '[\x00-\x1F\x7F]', '', 'g'));
  v_phone := btrim(regexp_replace(coalesce(p_phone, ''), '[^0-9+()\- ]', '', 'g'));
  if char_length(v_first) not between 1 and 80 then raise exception 'Nombre invalido.'; end if;
  if char_length(v_last) not between 1 and 80 then raise exception 'Apellido invalido.'; end if;
  if char_length(v_city) not between 1 and 80 then raise exception 'Ciudad invalida.'; end if;
  if char_length(v_nb) not between 1 and 80 then raise exception 'Barrio invalido.'; end if;
  if char_length(v_addr) not between 3 and 200 then raise exception 'Direccion invalida.'; end if;
  if char_length(v_phone) not between 5 and 30 then raise exception 'Numero de celular invalido.'; end if;

  if coalesce(p_use_account_email, true) then
    select u.email into v_email from auth.users u where u.id = v_uid;
  else
    v_email := btrim(lower(coalesce(p_email, '')));
  end if;
  if v_email is null or char_length(v_email) not between 5 and 160
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Correo electronico invalido.';
  end if;

  select z.id into v_zone
  from public.shipping_city_zones cz join public.shipping_zones z on z.id = cz.zone_id
  where cz.city_norm = public._shipping_norm(v_city) and z.active;
  if v_zone is null then select id into v_zone from public.shipping_zones where is_default and active; end if;
  select r.product_amount, r.shipping_amount, r.currency into v_prod, v_ship, v_curr
  from public.shipping_rates r where r.zone_id = v_zone and r.active;
  if v_prod is null then raise exception 'No hay tarifas de envio configuradas.'; end if;

  insert into public.plate_order_year_counters (year, next_seq) values (v_year, 0)
    on conflict (year) do nothing;
  update public.plate_order_year_counters set next_seq = next_seq + 1
    where year = v_year returning next_seq into v_seq;
  v_ref := 'PO-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');

  begin
    insert into public.plate_orders (
      reference, user_id, owner_pet_id, recipient_first_name, recipient_last_name,
      city, neighborhood, address, phone, email,
      shipping_zone_id, product_amount, shipping_amount, total_amount, currency
    ) values (
      v_ref, v_uid, p_pet_id, v_first, v_last,
      v_city, v_nb, v_addr, v_phone, v_email,
      v_zone, v_prod, v_ship, v_prod + v_ship, v_curr
    ) returning id into v_order;
  exception when unique_violation then
    raise exception 'Ya tienes una solicitud de placa activa para esta mascota.';
  end;

  insert into public.plate_order_events (order_id, event, actor_id) values (v_order, 'created', v_uid);
  insert into public.plate_payments (order_id, method, amount, currency, status)
    values (v_order, 'pending', v_prod + v_ship, v_curr, 'pending');

  return query select v_order, v_ref, v_prod + v_ship;
end;
$$;
revoke all on function public.plate_order_create(text, uuid, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.plate_order_create(text, uuid, text, text, text, text, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Mis pedidos (lista) y detalle (solo del usuario autenticado).
-- ---------------------------------------------------------------------------
create or replace function public.my_plate_orders()
returns table (
  id uuid, reference text, pet_name text, plate_code text,
  order_status text, payment_status text, shipment_status text, tracking_number text,
  total_amount integer, currency text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return query
  select o.id, o.reference, coalesce(p.name, op.name),
         t.short_code, o.order_status, o.payment_status,
         s.status, s.tracking_number, o.total_amount, o.currency, o.created_at
  from public.plate_orders o
  left join public.pets p on p.id = o.owner_pet_id
  left join public.organization_pets op on op.id = o.org_pet_id
  left join public.qr_tags t on t.id = o.qr_tag_id
  left join public.shipments s on s.order_id = o.id
  where o.user_id = v_uid
  order by o.created_at desc;
end;
$$;
revoke all on function public.my_plate_orders() from public, anon;
grant execute on function public.my_plate_orders() to authenticated;

create or replace function public.my_plate_order_detail(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select jsonb_build_object(
    'id', o.id, 'reference', o.reference,
    'pet_name', coalesce(p.name, op.name),
    'plate_code', t.short_code,
    'order_status', o.order_status, 'payment_status', o.payment_status,
    'product_amount', o.product_amount, 'shipping_amount', o.shipping_amount,
    'total_amount', o.total_amount, 'currency', o.currency,
    'city', o.city, 'neighborhood', o.neighborhood, 'address', o.address,
    'recipient', o.recipient_first_name || ' ' || o.recipient_last_name,
    'phone', o.phone, 'email', o.email,
    'created_at', o.created_at,
    'shipment', case when s.id is null then null else jsonb_build_object(
      'tracking_number', s.tracking_number, 'carrier', s.carrier, 'service', s.service,
      'status', s.status, 'shipped_at', s.shipped_at, 'delivered_at', s.delivered_at
    ) end,
    'shipment_events', coalesce((
      select jsonb_agg(jsonb_build_object('status', e.status, 'description', e.description, 'created_at', e.created_at)
             order by e.created_at)
      from public.shipment_events e where e.shipment_id = s.id
    ), '[]'::jsonb),
    'order_events', coalesce((
      select jsonb_agg(jsonb_build_object('event', ev.event, 'note', ev.note, 'created_at', ev.created_at)
             order by ev.created_at)
      from public.plate_order_events ev where ev.order_id = o.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.plate_orders o
  left join public.pets p on p.id = o.owner_pet_id
  left join public.organization_pets op on op.id = o.org_pet_id
  left join public.qr_tags t on t.id = o.qr_tag_id
  left join public.shipments s on s.order_id = o.id
  where o.id = p_order_id and o.user_id = v_uid;

  if v_result is null then raise exception 'Pedido no encontrado.'; end if;
  return v_result;
end;
$$;
revoke all on function public.my_plate_order_detail(uuid) from public, anon;
grant execute on function public.my_plate_order_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancelar (solo el dueño, solo si aun esta pendiente y sin pago aprobado).
-- ---------------------------------------------------------------------------
create or replace function public.plate_order_cancel(p_order_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ostatus text; v_pstatus text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select order_status, payment_status into v_ostatus, v_pstatus
  from public.plate_orders where id = p_order_id and user_id = v_uid for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_ostatus <> 'pending' or v_pstatus = 'approved' then
    raise exception 'Este pedido ya no se puede cancelar.';
  end if;
  update public.plate_orders set order_status = 'cancelled' where id = p_order_id;
  update public.plate_payments set status = 'cancelled' where order_id = p_order_id and status = 'pending';
  insert into public.plate_order_events (order_id, event, actor_id) values (p_order_id, 'cancelled', v_uid);
end;
$$;
revoke all on function public.plate_order_cancel(uuid) from public, anon;
grant execute on function public.plate_order_cancel(uuid) to authenticated;
