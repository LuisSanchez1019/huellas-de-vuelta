-- Huellas de Vuelta: NUEVA arquitectura de QR / placas.
-- El QR deja de ser una columna de la mascota y pasa a ser una ENTIDAD propia
-- que el ADMINISTRADOR genera por lotes y asigna despues a una mascota.
--
--   qr_batches   -> lote de produccion (referencia + cantidad).
--   qr_tags      -> una placa: id interno (uuid), public_id (token de la URL),
--                   short_code (codigo corto legible tipo HV-000001), estado y
--                   la mascota a la que esta asignada (pets O organization_pets).
--   qr_tag_events-> bitacora append-only de cada transicion.
--
-- Estados: available -> assigned -> active <-> suspended ; replaced ; annulled.
--   available : generada, sin mascota, lista para imprimir.
--   assigned  : vinculada a una mascota, pero el escaneo aun NO muestra el perfil.
--   active    : vinculada Y el escaneo muestra el perfil publico.
--   suspended : vinculada pero temporalmente inhabilitada (el escaneo no muestra).
--   replaced  : sustituida por otra placa; conserva historial.
--   annulled  : baja definitiva; no se reutiliza.
--
-- Seguridad: RLS de tabla = solo SELECT y solo admin. Toda escritura pasa por
-- RPC SECURITY DEFINER con is_admin() (migracion siguiente). El codigo corto NO
-- se usa en la URL: la URL usa un token aleatorio, igual que hoy.

-- ---------------------------------------------------------------------------
-- Secuencia global del codigo corto legible.
-- ---------------------------------------------------------------------------
create sequence if not exists public.qr_short_code_seq start 1;
revoke all on sequence public.qr_short_code_seq from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. qr_batches
-- ---------------------------------------------------------------------------
create table public.qr_batches (
  id uuid primary key default gen_random_uuid(),
  reference text not null check (char_length(btrim(reference)) between 2 and 120),
  quantity integer not null check (quantity between 1 and 5000),
  note text check (char_length(note) <= 300),
  is_system boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.qr_batches is
  'Lote de produccion de placas QR. Lo crea el administrador; genera N filas en qr_tags. is_system = lote interno (p.ej. placas heredadas de la migracion).';

create index qr_batches_created_idx on public.qr_batches (created_at desc);

alter table public.qr_batches enable row level security;

create policy "qr_batches_admin_read"
on public.qr_batches for select to authenticated
using (public.is_admin());

grant select on public.qr_batches to authenticated;

-- ---------------------------------------------------------------------------
-- 2. qr_tags
-- ---------------------------------------------------------------------------
create table public.qr_tags (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.qr_batches(id) on delete restrict,
  public_id text not null unique
    check (char_length(public_id) between 8 and 24),
  short_code text not null unique
    check (short_code ~ '^HV-[A-Z0-9-]{3,20}$'),
  status text not null default 'available'
    check (status in ('available','assigned','active','suspended','replaced','annulled')),
  owner_pet_id uuid references public.pets(id) on delete set null,
  org_pet_id uuid references public.organization_pets(id) on delete set null,
  assigned_at timestamptz,
  replaced_by_tag_id uuid references public.qr_tags(id) on delete set null,
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Como maximo una mascota (nunca ambas).
  constraint qr_tags_one_pet check (owner_pet_id is null or org_pet_id is null),
  -- 'available' nunca lleva mascota.
  constraint qr_tags_available_no_pet check (
    status <> 'available' or (owner_pet_id is null and org_pet_id is null)
  ),
  -- 'assigned' y 'active' SIEMPRE llevan mascota.
  constraint qr_tags_linked_has_pet check (
    status not in ('assigned','active','suspended')
    or (coalesce(owner_pet_id, org_pet_id) is not null)
  )
);

comment on table public.qr_tags is
  'Una placa QR. id = uuid interno. public_id = token de la URL /m/<public_id> (aleatorio, no enumerable). short_code = codigo corto legible impreso (HV-000001). Se asigna a una mascota de pets O de organization_pets.';

-- Una mascota (de cualquiera de las dos tablas) solo puede tener UNA placa
-- vinculada a la vez (assigned/active/suspended). replaced/annulled no cuentan.
create unique index qr_tags_one_live_per_owner_pet
  on public.qr_tags (owner_pet_id)
  where owner_pet_id is not null and status in ('assigned','active','suspended');
create unique index qr_tags_one_live_per_org_pet
  on public.qr_tags (org_pet_id)
  where org_pet_id is not null and status in ('assigned','active','suspended');

create index qr_tags_batch_idx on public.qr_tags (batch_id, short_code);
create index qr_tags_status_idx on public.qr_tags (status, updated_at desc);
create index qr_tags_owner_pet_idx on public.qr_tags (owner_pet_id) where owner_pet_id is not null;
create index qr_tags_org_pet_idx on public.qr_tags (org_pet_id) where org_pet_id is not null;

create trigger qr_tags_set_updated_at
before update on public.qr_tags
for each row execute procedure public.set_updated_at();

alter table public.qr_tags enable row level security;

create policy "qr_tags_admin_read"
on public.qr_tags for select to authenticated
using (public.is_admin());

grant select on public.qr_tags to authenticated;

-- ---------------------------------------------------------------------------
-- 3. qr_tag_events (bitacora append-only)
-- ---------------------------------------------------------------------------
create table public.qr_tag_events (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid references public.qr_tags(id) on delete set null,
  batch_id uuid references public.qr_batches(id) on delete set null,
  event text not null check (event in (
    'generated','assigned','activated','unassigned',
    'suspended','resumed','replaced','annulled'
  )),
  actor_id uuid references public.profiles(id),
  -- contexto de la mascota en el momento del evento (sobrevive a la desasignacion)
  owner_pet_id uuid,
  org_pet_id uuid,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

comment on table public.qr_tag_events is
  'Bitacora inmutable de una placa: generada / asignada / activada / desasignada / suspendida / reanudada / reemplazada / anulada. Conserva la mascota implicada aunque luego se desasigne.';

create index qr_tag_events_tag_idx on public.qr_tag_events (tag_id, created_at desc);
create index qr_tag_events_batch_idx on public.qr_tag_events (batch_id, created_at desc);

alter table public.qr_tag_events enable row level security;

create policy "qr_tag_events_admin_read"
on public.qr_tag_events for select to authenticated
using (public.is_admin());

grant select on public.qr_tag_events to authenticated;
