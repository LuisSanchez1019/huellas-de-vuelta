-- Telefono alterno opcional del titular. Amplia la tabla existente (no se crea
-- una segunda tabla de perfiles). Longitud razonable; formato flexible para
-- Colombia (se valida el minimo de digitos en la app y aqui).
alter table public.profiles
  add column if not exists phone_alt text
    check (phone_alt is null or char_length(btrim(phone_alt)) between 7 and 30);

comment on column public.profiles.phone_alt is
  'Telefono alterno opcional del titular. Dato privado: nunca se expone en respuestas publicas.';
