-- Huellas de Vuelta: reportes de mascota perdida.
--   * pet_reports: un reporte por transicion a PERDIDO; 1 activo por mascota
--   * set_pet_status(): cambia el estado de la mascota y crea/cierra el reporte, atomico
--   * list_public_lost_pets(): datos publicos para la landing (sin datos del propietario)
--   * is_public_pet_photo(): helper para que la foto de una perdida sea legible sin sesion

-- ---------------------------------------------------------------------------
-- 1. Tabla pet_reports
-- ---------------------------------------------------------------------------
create table public.pet_reports (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'lost' check (kind in ('lost')),
  status text not null default 'active' check (status in ('active', 'closed')),
  city text not null check (char_length(city) between 1 and 80),
  neighborhood text not null check (char_length(neighborhood) between 1 and 80),
  details text check (char_length(details) <= 100),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Un unico reporte activo por mascota: evita duplicar el reporte.
create unique index pet_reports_one_active_per_pet on public.pet_reports(pet_id) where status = 'active';
create index pet_reports_owner_status_idx on public.pet_reports(owner_id, status);

alter table public.pet_reports enable row level security;

create policy "pet_reports_owner_all"
on public.pet_reports for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
-- Sin politica para anon: lo publico se expone solo por list_public_lost_pets().

grant select, insert, update, delete on public.pet_reports to authenticated;

-- ---------------------------------------------------------------------------
-- 2. set_pet_status(): transicion atomica mascota + reporte
-- ---------------------------------------------------------------------------
create or replace function public.set_pet_status(
  p_pet_id uuid,
  p_status text,
  p_city text default null,
  p_neighborhood text default null,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.pets where id = p_pet_id;
  if v_owner is null then
    raise exception 'La mascota no existe.';
  end if;
  if v_owner <> (select auth.uid()) then
    raise exception 'No autorizado.';
  end if;
  if p_status not in ('at_home', 'lost', 'for_adoption') then
    raise exception 'Estado no valido: %', p_status;
  end if;

  -- La MISMA fila de la mascota; nunca se inserta otra.
  update public.pets set status = p_status::public.pet_status where id = p_pet_id;

  if p_status = 'lost' then
    if coalesce(trim(p_city), '') = '' or coalesce(trim(p_neighborhood), '') = '' then
      raise exception 'Ciudad y barrio son obligatorios para reportar una mascota perdida.';
    end if;
    if exists (select 1 from public.pet_reports where pet_id = p_pet_id and status = 'active') then
      update public.pet_reports
        set city = trim(p_city),
            neighborhood = trim(p_neighborhood),
            details = nullif(left(trim(coalesce(p_details, '')), 100), '')
        where pet_id = p_pet_id and status = 'active';
    else
      insert into public.pet_reports (pet_id, owner_id, kind, status, city, neighborhood, details)
      values (
        p_pet_id, v_owner, 'lost', 'active',
        trim(p_city), trim(p_neighborhood),
        nullif(left(trim(coalesce(p_details, '')), 100), '')
      );
    end if;
  else
    -- Volver a EN CASA o EN ADOPCION: cerrar el reporte activo, conservandolo como historial.
    update public.pet_reports
      set status = 'closed', closed_at = now()
      where pet_id = p_pet_id and status = 'active';
  end if;
end;
$$;

revoke all on function public.set_pet_status(uuid, text, text, text, text) from public;
grant execute on function public.set_pet_status(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. list_public_lost_pets(): para la landing (solo columnas seguras)
-- ---------------------------------------------------------------------------
create or replace function public.list_public_lost_pets()
returns table (
  report_id uuid,
  name text,
  species text,
  species_other text,
  breed text,
  age_value integer,
  age_unit text,
  sex text,
  color_primary text,
  color_secondary text,
  color_tertiary text,
  city text,
  neighborhood text,
  details text,
  photo_path text,
  reported_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.name, p.species, p.species_other, p.breed,
         p.age_value, p.age_unit, p.sex,
         p.color_primary, p.color_secondary, p.color_tertiary,
         r.city, r.neighborhood, r.details, p.photo_path, r.created_at
  from public.pet_reports r
  join public.pets p on p.id = r.pet_id
  where r.status = 'active' and r.kind = 'lost' and not p.is_archived
  order by r.created_at desc
  limit 60
$$;

revoke all on function public.list_public_lost_pets() from public;
grant execute on function public.list_public_lost_pets() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Foto publica de mascota perdida (sin exponer la tabla pets a anon)
-- ---------------------------------------------------------------------------
create or replace function public.is_public_pet_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pets
    where photo_path = object_name
      and status in ('lost', 'found')
      and not is_archived
  )
$$;

drop policy if exists "pet_photos_public_lost_found" on storage.objects;
create policy "pet_photos_public_lost_found"
on storage.objects for select to anon, authenticated
using (bucket_id = 'pet-photos' and public.is_public_pet_photo(name));

comment on table public.pet_reports is 'Reportes de mascota perdida. 1 activo por mascota; los cerrados quedan como historial.';
comment on function public.set_pet_status(uuid, text, text, text, text) is 'Cambia el estado de la mascota y crea/cierra su reporte de perdida de forma atomica.';
comment on function public.list_public_lost_pets() is 'Mascotas con reporte de perdida activo para la landing. No expone owner_id ni contacto.';
