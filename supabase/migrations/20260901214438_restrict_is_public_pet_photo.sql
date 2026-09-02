-- (revertida en la migración siguiente) intento de quitar EXECUTE público al helper
-- de la política de storage. Las políticas RLS de Postgres exigen que el rol
-- invocante tenga EXECUTE sobre las funciones que referencian, así que se re-otorga.
revoke execute on function public.is_public_pet_photo(text) from anon, authenticated, public;
