-- Huellas de Vuelta: bucket PRIVADO de posters. Un poster pendiente NO debe ser
-- accesible por URL publica: la lectura anonima solo se permite cuando el poster
-- esta aprobado + vigente + su organizacion activa (poster_object_is_public).
-- La Landing firma las URL server-side (como pet-photos).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-posters', 'org-posters', false, 3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "org_posters_rw_own" on storage.objects;
create policy "org_posters_rw_own"
on storage.objects for all to authenticated
using (
  bucket_id = 'org-posters'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'org-posters'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "org_posters_read_public_when_live" on storage.objects;
create policy "org_posters_read_public_when_live"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'org-posters'
  and public.poster_object_is_public(name)
);

drop policy if exists "org_posters_read_admin" on storage.objects;
create policy "org_posters_read_admin"
on storage.objects for select to authenticated
using (bucket_id = 'org-posters' and public.is_admin());
