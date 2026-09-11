-- Huellas de Vuelta: pedidos de placa, pagos y envios. Entidades SEPARADAS:
--   MASCOTA -> PLACA (qr_tags) -> PEDIDO (plate_orders) -> PAGO (plate_payments)
--          -> ENVIO (shipments) -> GUIA (shipments.tracking_number) -> EVENTOS
-- Modelo de esta fase: 1 pedido -> 1 mascota -> 1 placa. Sin carrito.
-- Toda escritura pasa por RPC SECURITY DEFINER. RLS de tabla: solo lectura del
-- dueño (user_id = auth.uid()) o admin. Nada publico. Direcciones nunca en
-- get_public_pet ni en respuestas publicas.

-- ---------------------------------------------------------------------------
-- Contadores (referencia de pedido por año, guia por año)
-- ---------------------------------------------------------------------------
create table public.plate_order_year_counters (
  year integer primary key,
  next_seq integer not null default 0
);
create table public.shipment_year_counters (
  year integer primary key,
  next_seq integer not null default 0
);
alter table public.plate_order_year_counters enable row level security;
alter table public.shipment_year_counters enable row level security;
revoke all on table public.plate_order_year_counters, public.shipment_year_counters
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- plate_orders
-- ---------------------------------------------------------------------------
create table public.plate_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  owner_pet_id uuid references public.pets(id) on delete restrict,
  org_pet_id uuid references public.organization_pets(id) on delete restrict,
  qr_tag_id uuid references public.qr_tags(id) on delete set null,

  recipient_first_name text not null check (char_length(btrim(recipient_first_name)) between 1 and 80),
  recipient_last_name  text not null check (char_length(btrim(recipient_last_name)) between 1 and 80),
  city         text not null check (char_length(btrim(city)) between 1 and 80),
  neighborhood text not null check (char_length(btrim(neighborhood)) between 1 and 80),
  address      text not null check (char_length(btrim(address)) between 3 and 200),
  phone        text not null check (char_length(btrim(phone)) between 5 and 30),
  email        text not null check (char_length(email) between 5 and 160),

  shipping_zone_id uuid not null references public.shipping_zones(id) on delete restrict,
  product_amount  integer not null check (product_amount >= 0),
  shipping_amount integer not null check (shipping_amount >= 0),
  total_amount    integer not null check (total_amount >= 0),
  currency text not null default 'COP',

  order_status text not null default 'pending'
    check (order_status in ('pending','confirmed','preparing','ready_to_ship','shipped','delivered','cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','approved','rejected','cancelled','refunded')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plate_orders_exactly_one_pet check (num_nonnulls(owner_pet_id, org_pet_id) = 1),
  constraint plate_orders_total_ok check (total_amount = product_amount + shipping_amount)
);
comment on table public.plate_orders is
  'Solicitud de placa de un usuario para UNA mascota propia. Los importes los calcula el backend (nunca el frontend). qr_tag_id se asigna cuando el admin prepara el envio.';

create index plate_orders_user_idx on public.plate_orders (user_id, created_at desc);
create index plate_orders_status_idx on public.plate_orders (order_status, created_at desc);
-- Una sola solicitud ACTIVA por mascota (concurrencia: lo garantiza el indice).
create unique index plate_orders_one_active_per_owner_pet
  on public.plate_orders (owner_pet_id)
  where owner_pet_id is not null and order_status not in ('cancelled','delivered');
create unique index plate_orders_one_active_per_org_pet
  on public.plate_orders (org_pet_id)
  where org_pet_id is not null and order_status not in ('cancelled','delivered');

create trigger plate_orders_set_updated_at
before update on public.plate_orders
for each row execute procedure public.set_updated_at();

alter table public.plate_orders enable row level security;
create policy "plate_orders_owner_read" on public.plate_orders for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
grant select on public.plate_orders to authenticated;

-- ---------------------------------------------------------------------------
-- plate_order_events (bitacora)
-- ---------------------------------------------------------------------------
create table public.plate_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.plate_orders(id) on delete cascade,
  event text not null check (event in (
    'created','payment_pending','payment_approved','payment_rejected','payment_refunded',
    'confirmed','preparing','plate_assigned','ready_to_ship','shipped','delivered','cancelled'
  )),
  note text check (char_length(note) <= 300),
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index plate_order_events_idx on public.plate_order_events (order_id, created_at);
alter table public.plate_order_events enable row level security;
create policy "plate_order_events_owner_read" on public.plate_order_events for select to authenticated
  using (exists (select 1 from public.plate_orders o
    where o.id = order_id and (o.user_id = (select auth.uid()) or public.is_admin())));
grant select on public.plate_order_events to authenticated;

-- ---------------------------------------------------------------------------
-- plate_payments
-- ---------------------------------------------------------------------------
create table public.plate_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.plate_orders(id) on delete cascade,
  method text not null default 'pending' check (char_length(method) <= 40),
  amount integer not null check (amount >= 0),
  currency text not null default 'COP',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled','refunded')),
  provider_reference text check (char_length(provider_reference) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.plate_payments is
  'Pago del pedido. SIN pasarela real todavia. El frontend NUNCA marca un pago como aprobado: lo hace un RPC de admin.';
create index plate_payments_order_idx on public.plate_payments (order_id, created_at desc);
create trigger plate_payments_set_updated_at
before update on public.plate_payments
for each row execute procedure public.set_updated_at();
alter table public.plate_payments enable row level security;
create policy "plate_payments_owner_read" on public.plate_payments for select to authenticated
  using (exists (select 1 from public.plate_orders o
    where o.id = order_id and (o.user_id = (select auth.uid()) or public.is_admin())));
grant select on public.plate_payments to authenticated;

-- ---------------------------------------------------------------------------
-- shipments
-- ---------------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.plate_orders(id) on delete cascade,
  tracking_number text not null unique,
  carrier text check (char_length(carrier) <= 60),
  service text check (char_length(service) <= 60),
  status text not null default 'pending'
    check (status in ('pending','preparing','shipped','in_transit','out_for_delivery','delivered','exception','cancelled')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.shipments is
  'Envio de un pedido. tracking_number (guia) lo genera el backend al crear el envio; NUNCA es el short_code ni el public_id de la placa.';
create index shipments_status_idx on public.shipments (status, created_at desc);
create trigger shipments_set_updated_at
before update on public.shipments
for each row execute procedure public.set_updated_at();
alter table public.shipments enable row level security;
create policy "shipments_owner_read" on public.shipments for select to authenticated
  using (exists (select 1 from public.plate_orders o
    where o.id = order_id and (o.user_id = (select auth.uid()) or public.is_admin())));
grant select on public.shipments to authenticated;

-- ---------------------------------------------------------------------------
-- shipment_events
-- ---------------------------------------------------------------------------
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null check (status in
    ('CREATED','PREPARED','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION','CANCELLED')),
  description text check (char_length(description) <= 300),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index shipment_events_idx on public.shipment_events (shipment_id, created_at);
alter table public.shipment_events enable row level security;
create policy "shipment_events_owner_read" on public.shipment_events for select to authenticated
  using (exists (
    select 1 from public.shipments s join public.plate_orders o on o.id = s.order_id
    where s.id = shipment_id and (o.user_id = (select auth.uid()) or public.is_admin())));
grant select on public.shipment_events to authenticated;

-- ---------------------------------------------------------------------------
-- Generador de numero de guia: HV<AAAA>-<######>-<XXX aleatorio>
-- ---------------------------------------------------------------------------
create or replace function public._gen_tracking_number()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_seq integer;
  v_suffix text;
begin
  insert into public.shipment_year_counters (year, next_seq) values (v_year, 0)
  on conflict (year) do nothing;
  update public.shipment_year_counters set next_seq = next_seq + 1
  where year = v_year returning next_seq into v_seq;
  v_suffix := upper(substr(replace(encode(extensions.gen_random_bytes(4), 'base64'), '/', 'x'), 1, 3));
  return 'HV' || v_year::text || '-' || lpad(v_seq::text, 6, '0') || '-' || v_suffix;
end;
$$;
revoke all on function public._gen_tracking_number() from public, anon, authenticated;
