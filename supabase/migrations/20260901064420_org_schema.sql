-- Huellas de Vuelta: esquema para la plataforma multi-rol.
--   * profiles: nombre/apellido/teléfono/avatar
--   * organization_profiles: perfil público de fundaciones y veterinarias (una tabla, columna kind)
--   * organization_pets: mascotas cargadas por fundaciones/veterinarias (carga masiva)
--   * get_public_pet(): lectura pública de una mascota por su public_id (para el QR)

-- ---------------------------------------------------------------------------
-- 1. profiles: datos personales de la cuenta
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists first_name  text,
  add column if not exists last_name   text,
  add column if not exists phone       text,
  add column if not exists avatar_path text;

alter table public.profiles
  add constraint profiles_first_name_len  check (char_length(first_name)  <= 60),
  add constraint profiles_last_name_len   check (char_length(last_name)   <= 60),
  add constraint profiles_phone_len       check (char_length(phone)       <= 30),
  add constraint profiles_avatar_path_len check (char_length(avatar_path) <= 255);

-- Backfill suave de las cuentas existentes a partir de display_name.
update public.profiles
set first_name = nullif(split_part(display_name, ' ', 1), ''),
    last_name  = nullif(trim(substr(display_name, length(split_part(display_name, ' ', 1)) + 1)), '')
where first_name is null and display_name is not null;

-- El trigger de alta ahora también guarda nombre y apellido del metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, first_name, last_name, role)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    (case new.raw_user_meta_data ->> 'role'
       when 'fundacion' then 'fundacion'
       when 'veterinaria' then 'veterinaria'
       else 'usuario'
     end)::public.account_role
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. organization_profiles (fundación | veterinaria)
-- ---------------------------------------------------------------------------
create table public.organization_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('fundacion', 'veterinaria')),
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 120),
  logo_url text check (char_length(logo_url) <= 500),
  cover_image_url text check (char_length(cover_image_url) <= 500),
  description text check (char_length(description) <= 800),
  phone text check (char_length(phone) <= 30),
  whatsapp text check (char_length(whatsapp) <= 30),
  email text check (char_length(email) <= 160),
  hours jsonb not null default '[]'::jsonb,
  services text[] not null default '{}'::text[],
  social jsonb not null default '{}'::jsonb,
  address text check (char_length(address) <= 200),
  city text check (char_length(city) <= 80),
  map_url text check (char_length(map_url) <= 500),
  lat double precision check (lat is null or (lat between -90 and 90)),
  lng double precision check (lng is null or (lng between -180 and 180)),
  extra_info text check (char_length(extra_info) <= 800),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organization_profiles_kind_status_idx on public.organization_profiles(kind, status);

create trigger organization_profiles_set_updated_at
before update on public.organization_profiles
for each row execute procedure public.set_updated_at();

-- El kind del perfil debe coincidir con el rol de la cuenta.
create or replace function public.enforce_org_kind_matches_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare account_role text;
begin
  select role::text into account_role from public.profiles where id = new.owner_id;
  if account_role is distinct from new.kind then
    raise exception 'El tipo de perfil (%) no coincide con el rol de la cuenta (%).', new.kind, account_role;
  end if;
  return new;
end;
$$;

create trigger organization_profiles_enforce_kind
before insert or update on public.organization_profiles
for each row execute procedure public.enforce_org_kind_matches_role();

alter table public.organization_profiles enable row level security;

create policy "org_profiles_owner_all"
on public.organization_profiles for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "org_profiles_public_read"
on public.organization_profiles for select to anon, authenticated
using (status = 'published');

-- ---------------------------------------------------------------------------
-- 3. organization_pets (carga masiva de fundaciones/veterinarias)
-- ---------------------------------------------------------------------------
create table public.organization_pets (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.gen_pet_public_id(),
  org_id uuid not null references public.profiles(id) on delete cascade,
  org_kind text not null check (org_kind in ('fundacion', 'veterinaria')),
  name text not null check (char_length(name) between 1 and 80),
  species text not null check (species in ('dog', 'cat', 'other')),
  species_other text check (char_length(species_other) <= 60),
  breed text check (char_length(breed) <= 100),
  age text check (char_length(age) <= 40),
  sex text not null default 'unspecified' check (sex in ('male', 'female', 'unspecified')),
  status text not null default 'available' check (status in ('available', 'in_treatment', 'reserved', 'adopted')),
  photo_url text check (char_length(photo_url) <= 500),
  intake_date date,
  needs_home boolean not null default false,
  needs_sponsor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organization_pets_org_idx on public.organization_pets(org_id);
create index organization_pets_public_idx on public.organization_pets(needs_home, needs_sponsor)
  where needs_home or needs_sponsor;

create trigger organization_pets_set_updated_at
before update on public.organization_pets
for each row execute procedure public.set_updated_at();

alter table public.organization_pets enable row level security;

create policy "org_pets_owner_all"
on public.organization_pets for all to authenticated
using ((select auth.uid()) = org_id)
with check ((select auth.uid()) = org_id);

create policy "org_pets_public_read"
on public.organization_pets for select to anon, authenticated
using (needs_home or needs_sponsor);

-- ---------------------------------------------------------------------------
-- 4. Lectura pública de una mascota por su public_id (para el QR / placa)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_pet(p_public_id text)
returns table (
  public_id text,
  name text,
  species text,
  species_other text,
  breed text,
  color_primary text,
  color_secondary text,
  color_tertiary text,
  age_value integer,
  age_unit text,
  sex text,
  description text,
  status text,
  photo_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select public_id, name, species, species_other, breed,
         color_primary, color_secondary, color_tertiary,
         age_value, age_unit, sex, description, status::text, photo_path
  from public.pets
  where public_id = p_public_id and not is_archived
$$;

revoke all on function public.get_public_pet(text) from public;
grant execute on function public.get_public_pet(text) to anon, authenticated;

-- Las fotos de mascotas perdidas/encontradas se pueden leer sin sesión: es el
-- objetivo del QR (quien la encuentra ve la foto). El resto siguen privadas.
drop policy if exists "pet_photos_public_lost_found" on storage.objects;
create policy "pet_photos_public_lost_found"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'pet-photos'
  and exists (
    select 1 from public.pets
    where pets.photo_path = storage.objects.name
      and pets.status in ('lost', 'found')
      and not pets.is_archived
  )
);

comment on table public.organization_profiles is 'Perfil público de fundaciones y veterinarias (kind).';
comment on table public.organization_pets is 'Mascotas gestionadas por una fundación/veterinaria (carga masiva).';
comment on function public.get_public_pet(text) is 'Datos públicos de una mascota por su public_id (QR). No expone owner_id.';
