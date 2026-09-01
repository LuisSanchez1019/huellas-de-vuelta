-- Endurecimiento tras el advisor de seguridad de Supabase:
--   * fijar search_path en las funciones que no lo tenían
--   * quitar EXECUTE público a las funciones de trigger (no son RPC)
-- NOTA: gen_pet_public_id vuelve a corregirse en la migración siguiente
-- (search_path = '' obliga a calificar extensions.gen_random_bytes).

alter function public.lock_profile_role() set search_path = '';

revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.lock_profile_role() from anon, authenticated, public;
revoke execute on function public.enforce_org_kind_matches_role() from anon, authenticated, public;

-- get_public_pet SÍ es pública a propósito (la usa la página del QR sin sesión);
-- solo devuelve columnas no sensibles. Se mantiene el grant a anon/authenticated.
