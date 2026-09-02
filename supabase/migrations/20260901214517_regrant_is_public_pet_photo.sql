-- is_public_pet_photo se usa dentro de la política de storage.objects (landing).
-- Debe ser ejecutable por anon/authenticated para que la política evalúe.
grant execute on function public.is_public_pet_photo(text) to anon, authenticated;
