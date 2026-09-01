-- Huellas de Vuelta: campos adicionales para el formulario "Registrar mascota" v1
-- y bucket de Storage para las fotos de las mascotas.
-- Ejecutar en un proyecto que ya tenga la migracion inicial aplicada.

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas en public.pets
-- ---------------------------------------------------------------------------
alter table public.pets
  add column if not exists species_other   text,
  add column if not exists age_value       integer,
  add column if not exists age_unit        text,
  add column if not exists sex             text,
  add column if not exists color_primary   text,
  add column if not exists color_secondary text,
  add column if not exists color_tertiary  text,
  add column if not exists photo_path      text;

alter table public.pets
  add constraint pets_species_other_len check (char_length(species_other) <= 60),
  add constraint pets_age_value_range   check (age_value is null or (age_value >= 0 and age_value <= 1200)),
  add constraint pets_age_unit_valid    check (age_unit is null or age_unit in ('months', 'years')),
  add constraint pets_sex_valid         check (sex is null or sex in ('male', 'female', 'unspecified')),
  add constraint pets_color_primary_len   check (char_length(color_primary) <= 40),
  add constraint pets_color_secondary_len check (char_length(color_secondary) <= 40),
  add constraint pets_color_tertiary_len  check (char_length(color_tertiary) <= 40),
  add constraint pets_colors_distinct check (
    (color_secondary is null or color_secondary <> color_primary)
    and (color_tertiary is null or (color_tertiary <> color_primary and color_tertiary <> color_secondary))
  ),
  add constraint pets_photo_path_len check (char_length(photo_path) <= 255);

comment on column public.pets.species_other   is 'Tipo/especie en texto libre, solo cuando species = ''other''.';
comment on column public.pets.age_value        is 'Edad numerica; la unidad esta en age_unit.';
comment on column public.pets.age_unit          is 'Unidad de la edad: months | years.';
comment on column public.pets.sex               is 'Sexo: male | female | unspecified.';
comment on column public.pets.color_primary    is 'Color principal (lista controlada en la app). Obligatorio para gatos.';
comment on column public.pets.color_secondary  is 'Color secundario opcional; distinto del principal.';
comment on column public.pets.color_tertiary   is 'Color adicional opcional; distinto del principal y del secundario.';
comment on column public.pets.photo_path        is 'Ruta del objeto en el bucket pet-photos (no URL). Formato: <owner_id>/<pet_id>.webp';

-- La columna legacy "color" queda para compatibilidad con pantallas antiguas; el
-- formulario nuevo ya no la escribe.

-- ---------------------------------------------------------------------------
-- 2. Bucket privado para las fotos de las mascotas
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-photos', 'pet-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 3. Politicas RLS de Storage: cada persona gestiona solo su propia carpeta
--    (el primer segmento de la ruta debe ser su auth.uid()).
-- ---------------------------------------------------------------------------
drop policy if exists "pet_photos_insert_own" on storage.objects;
create policy "pet_photos_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'pet-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "pet_photos_select_own" on storage.objects;
create policy "pet_photos_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'pet-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "pet_photos_update_own" on storage.objects;
create policy "pet_photos_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'pet-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'pet-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "pet_photos_delete_own" on storage.objects;
create policy "pet_photos_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'pet-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
