-- Comprobación mínima de disponibilidad de Supabase/Postgres.
-- La consume el cron diario GET /api/cron/health vía RPC (rol anon, cliente
-- público del servidor). No lee tablas de negocio, ni Auth, ni Storage: solo
-- ejecuta una operación SQL real y devuelve la hora del servidor.
create or replace function public.health_check()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

-- Permisos explícitos: solo anon (el rol que usa createSupabasePublicServerClient).
revoke all on function public.health_check() from public, anon, authenticated;
grant execute on function public.health_check() to anon;
