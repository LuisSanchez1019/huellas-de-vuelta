-- Los roles anon/authenticated no tenían privilegios DML sobre las tablas
-- (solo REFERENCES/TRIGGER/TRUNCATE), así que PostgREST devolvía 403 a todo.
-- La seguridad real la da RLS (ya activo); estos GRANT solo permiten llegar a la tabla.

grant select, insert, update, delete on public.pets to authenticated;
grant select, insert, update, delete on public.organization_pets to authenticated;
grant select, insert, update, delete on public.organization_profiles to authenticated;
grant select, update on public.profiles to authenticated;

-- Lecturas públicas para la landing (RLS las limita a published / needs_home|needs_sponsor).
grant select on public.organization_profiles to anon;
grant select on public.organization_pets to anon;

-- Que las tablas futuras hereden estos privilegios.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
