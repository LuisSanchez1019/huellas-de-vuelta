-- Pais de la organizacion. Se expone primero en el perfil de aliado (la
-- plataforma opera principalmente en Colombia, por eso el resto de perfiles
-- no lo pedian todavia). Nullable: no afecta filas existentes ni RLS.
alter table public.organization_profiles add column country text;
comment on column public.organization_profiles.country is 'Pais de la organizacion (texto libre). Usado por el perfil de aliado.';
