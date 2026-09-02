-- Huellas de Vuelta: módulos de veterinaria / fundación.
--   * organization_profiles.logo_path: ruta del logo en Storage (bucket org-logos)
--   * organization_pets.photo_path: foto subida por el formulario "Agregar mascota"
--   * bucket público org-logos + políticas de escritura acotadas al dueño
-- No se cambian RLS de organization_profiles / organization_pets (ya cubren el caso).

alter table public.organization_profiles
  add column if not exists logo_path text check (char_length(logo_path) <= 400);

comment on column public.organization_profiles.logo_path is
  'Ruta del logo en el bucket org-logos. La UI prefiere logo_path sobre logo_url.';

alter table public.organization_pets
  add column if not exists photo_path text check (char_length(photo_path) <= 400);

comment on column public.organization_pets.photo_path is
  'Foto subida a pet-photos/<org_id>/orgpet/... por el alta una-por-una. photo_url queda para la carga por Excel.';

-- ---------------------------------------------------------------------------
-- Bucket público de logos de organización
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-logos', 'org-logos', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- Escritura solo en la carpeta propia (<owner_id>/...). Lectura pública por public = true.
drop policy if exists "org_logos_insert_own" on storage.objects;
create policy "org_logos_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'org-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "org_logos_update_own" on storage.objects;
create policy "org_logos_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'org-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'org-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "org_logos_delete_own" on storage.objects;
create policy "org_logos_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'org-logos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
