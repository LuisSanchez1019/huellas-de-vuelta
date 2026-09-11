-- Huellas de Vuelta: seccion "Informacion medica" de una mascota.
-- NO es una historia clinica. Es un resumen sencillo, valido para mascotas de
-- usuario (public.pets) y de organizacion (public.organization_pets).
--
--   pet_medical_summary : 1 fila por mascota. Flags Si/No, observaciones y los
--                         interruptores de visibilidad publica.
--   pet_medical_items   : 0..N condiciones / alergias / medicamentos / urgencias.
--                         Cada fila guarda su FUENTE (owner / vet / fundacion).
--
-- Visibilidad publica: la informacion privada NUNCA se publica automaticamente.
-- El perfil publico solo puede mostrar (si se autorizo) una alerta generica y,
-- aparte, el aviso de "requiere medicamento urgente". Nunca el texto.

-- ---------------------------------------------------------------------------
-- 1. pet_medical_summary
-- ---------------------------------------------------------------------------
create table public.pet_medical_summary (
  id uuid primary key default gen_random_uuid(),
  owner_pet_id uuid references public.pets(id) on delete cascade,
  org_pet_id uuid references public.organization_pets(id) on delete cascade,
  has_condition boolean not null default false,
  has_allergy boolean not null default false,
  has_medication boolean not null default false,
  has_urgent boolean not null default false,
  notes text check (char_length(notes) <= 500),
  public_alert_enabled boolean not null default false,
  public_urgent_enabled boolean not null default false,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pms_exactly_one_pet check (num_nonnulls(owner_pet_id, org_pet_id) = 1)
);

comment on table public.pet_medical_summary is
  'Resumen medico (1:1) de una mascota de usuario o de organizacion. Contiene los flags Si/No, observaciones y los interruptores de visibilidad publica. El texto medico nunca se publica.';

create unique index pet_medical_summary_owner_pet_key
  on public.pet_medical_summary (owner_pet_id) where owner_pet_id is not null;
create unique index pet_medical_summary_org_pet_key
  on public.pet_medical_summary (org_pet_id) where org_pet_id is not null;

create trigger pet_medical_summary_set_updated_at
before update on public.pet_medical_summary
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. pet_medical_items
-- ---------------------------------------------------------------------------
create table public.pet_medical_items (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references public.pet_medical_summary(id) on delete cascade,
  kind text not null check (kind in ('condition','allergy','medication','urgent')),
  label text not null check (char_length(btrim(label)) between 1 and 150),
  detail text check (char_length(detail) <= 250),
  source text not null check (source in ('owner','vet','fundacion')),
  author_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pet_medical_items is
  'Condiciones / alergias / medicamentos / tratamientos urgentes de una mascota (1:N). "source" distingue lo aportado por el propietario de lo registrado por la veterinaria o la fundacion; nunca se mezclan.';

create index pet_medical_items_summary_idx on public.pet_medical_items (summary_id, kind, created_at);

create trigger pet_medical_items_set_updated_at
before update on public.pet_medical_items
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS: lectura para el propietario / la organizacion dueña / el admin.
--    La ESCRITURA no se concede a nadie por tabla: pasa por RPC SECURITY DEFINER.
-- ---------------------------------------------------------------------------
alter table public.pet_medical_summary enable row level security;
alter table public.pet_medical_items enable row level security;

create policy "pms_read"
on public.pet_medical_summary for select to authenticated
using (
  public.is_admin()
  or (owner_pet_id is not null and exists (
        select 1 from public.pets p
        where p.id = owner_pet_id and p.owner_id = (select auth.uid())))
  or (org_pet_id is not null and exists (
        select 1 from public.organization_pets op
        where op.id = org_pet_id and op.org_id = (select auth.uid())))
);

create policy "pmi_read"
on public.pet_medical_items for select to authenticated
using (
  exists (
    select 1 from public.pet_medical_summary s
    where s.id = summary_id and (
      public.is_admin()
      or (s.owner_pet_id is not null and exists (
            select 1 from public.pets p
            where p.id = s.owner_pet_id and p.owner_id = (select auth.uid())))
      or (s.org_pet_id is not null and exists (
            select 1 from public.organization_pets op
            where op.id = s.org_pet_id and op.org_id = (select auth.uid())))
    )
  )
);

grant select on public.pet_medical_summary to authenticated;
grant select on public.pet_medical_items to authenticated;
