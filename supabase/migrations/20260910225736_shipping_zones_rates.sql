-- Huellas de Vuelta: tarifas de envio de placas. El backend determina
-- ciudad -> zona -> tarifa -> costo -> total. El frontend NUNCA envia importes.
-- Montos PROVISIONALES (editables por el admin mas adelante).

-- ---------------------------------------------------------------------------
-- Normalizador de nombre de ciudad (minusculas, sin acentos, sin espacios extra)
-- ---------------------------------------------------------------------------
create or replace function public._shipping_norm(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p, '')),
      'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
    '\s+', ' ', 'g'))
$$;

-- ---------------------------------------------------------------------------
-- Zonas
-- ---------------------------------------------------------------------------
create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 80),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.shipping_zones is
  'Zona de envio de placas. Una sola zona con is_default = true (fallback cuando la ciudad no esta mapeada).';
create unique index shipping_zones_one_default on public.shipping_zones (is_default) where is_default;

create trigger shipping_zones_set_updated_at
before update on public.shipping_zones
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tarifas (1 activa por zona)
-- ---------------------------------------------------------------------------
create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.shipping_zones(id) on delete cascade,
  product_amount integer not null check (product_amount >= 0),
  shipping_amount integer not null check (shipping_amount >= 0),
  currency text not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.shipping_rates is
  'Tarifa de placa + envio por zona. product_amount = precio de la placa; shipping_amount = costo de envio. Importes en la menor unidad de COP (pesos enteros). Montos actuales PROVISIONALES.';
create unique index shipping_rates_one_active_per_zone
  on public.shipping_rates (zone_id) where active;

create trigger shipping_rates_set_updated_at
before update on public.shipping_rates
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ciudad -> zona
-- ---------------------------------------------------------------------------
create table public.shipping_city_zones (
  id uuid primary key default gen_random_uuid(),
  city_norm text not null unique,
  zone_id uuid not null references public.shipping_zones(id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.shipping_city_zones is
  'Mapeo de ciudad normalizada (_shipping_norm) a zona de envio. Si una ciudad no esta aqui, se usa la zona is_default.';

-- ---------------------------------------------------------------------------
-- RLS: todo por RPC SECURITY DEFINER. Sin acceso directo.
-- ---------------------------------------------------------------------------
alter table public.shipping_zones enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.shipping_city_zones enable row level security;
revoke all on table public.shipping_zones, public.shipping_rates, public.shipping_city_zones
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Semilla (Santander metro + resto del pais). Montos PROVISIONALES.
-- ---------------------------------------------------------------------------
do $$
declare v_metro uuid; v_resto uuid;
begin
  insert into public.shipping_zones (name, is_default, sort_order)
  values ('Bucaramanga y area metropolitana', false, 1)
  returning id into v_metro;

  insert into public.shipping_zones (name, is_default, sort_order)
  values ('Resto de Colombia', true, 2)
  returning id into v_resto;

  insert into public.shipping_rates (zone_id, product_amount, shipping_amount, note)
  values
    (v_metro, 25000, 12000, 'Provisional: placa 25.000 + envio 12.000'),
    (v_resto, 25000, 18000, 'Provisional: placa 25.000 + envio 18.000');

  insert into public.shipping_city_zones (city_norm, zone_id) values
    (public._shipping_norm('Bucaramanga'), v_metro),
    (public._shipping_norm('Floridablanca'), v_metro),
    (public._shipping_norm('Giron'), v_metro),
    (public._shipping_norm('Piedecuesta'), v_metro);
end $$;
