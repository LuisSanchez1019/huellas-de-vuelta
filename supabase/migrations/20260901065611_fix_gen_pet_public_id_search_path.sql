-- gen_random_bytes vive en el esquema `extensions` (pgcrypto), no en pg_catalog.
-- Con search_path = '' hay que calificar todo explícitamente.
create or replace function public.gen_pet_public_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('0123456789abcdefghjkmnpqrstvwxyz',
           (pg_catalog.get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1, 1), '')
  from pg_catalog.generate_series(1, 12)
$$;
