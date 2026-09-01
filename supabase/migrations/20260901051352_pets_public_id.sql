-- Huellas de Vuelta: identificador publico corto por mascota para el QR / placa.
-- El QR apunta a /m/<public_id>; este token no expone el UUID interno ni permite
-- enumerar mascotas.

-- Genera un token de 12 caracteres en base32 sin caracteres ambiguos (sin i, l, o, u).
create or replace function public.gen_pet_public_id()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('0123456789abcdefghjkmnpqrstvwxyz',
           (get_byte(gen_random_bytes(1), 0) % 32) + 1, 1), '')
  from generate_series(1, 12)
$$;

alter table public.pets add column if not exists public_id text;

update public.pets set public_id = public.gen_pet_public_id() where public_id is null;

alter table public.pets
  alter column public_id set default public.gen_pet_public_id(),
  alter column public_id set not null,
  add constraint pets_public_id_key unique (public_id),
  add constraint pets_public_id_len check (char_length(public_id) between 6 and 24);

comment on column public.pets.public_id is
  'Identificador publico corto para el QR/placa. No expone el UUID interno.';
