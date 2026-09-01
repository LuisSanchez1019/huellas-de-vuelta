-- Huellas de Vuelta: rol de cuenta (usuario / fundacion / veterinaria).
-- El login es unico; el rol decide a que panel y rutas entra cada cuenta.

create type public.account_role as enum ('usuario', 'fundacion', 'veterinaria');

alter table public.profiles
  add column if not exists role public.account_role not null default 'usuario';

-- El trigger de alta ahora tambien fija el rol desde el metadata del registro,
-- validando el valor para no romper el alta si llega algo inesperado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    (case new.raw_user_meta_data ->> 'role'
       when 'fundacion' then 'fundacion'
       when 'veterinaria' then 'veterinaria'
       else 'usuario'
     end)::public.account_role
  );
  return new;
end;
$$;

-- Impide que una cuenta cambie su propio rol desde el cliente. La politica RLS
-- permite UPDATE de la fila propia, asi que sin este trigger un usuario podria
-- auto-asignarse otro rol. El rol solo se fija en el alta (o por un proceso
-- administrativo con service_role, que salta RLS y triggers de fila).
create or replace function public.lock_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role
before update on public.profiles
for each row execute procedure public.lock_profile_role();

comment on column public.profiles.role is
  'Tipo de cuenta: usuario | fundacion | veterinaria. Se fija en el alta y no es editable por el cliente.';
