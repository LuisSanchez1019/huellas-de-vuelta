-- Huellas de Vuelta: endurecimiento del rol administrador.
--   * Primer administrador: se asigna UNA sola vez por email en esta migracion.
--     Despues, el acceso depende exclusivamente de profiles.is_admin.
--   * set_user_admin(): un admin promueve/degrada a otro usuario existente.
--     Protege al ultimo administrador del sistema.
--   * set_org_active(): un admin desactiva/reactiva una organizacion.
--   * Triggers lock_profile_role / lock_org_approval_columns: reforzados para no
--     depender del GUC request.jwt.claims (usan auth.uid()).
--
-- No se crea ninguna estructura nueva de roles: se reutiliza profiles.is_admin.

-- ===========================================================================
-- 1. Primer administrador (una sola vez, por email)
-- ===========================================================================
-- Unico punto donde aparece un email. Es idempotente y no deja ninguna
-- dependencia en el codigo de la aplicacion.
update public.profiles p
   set is_admin = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = lower('luissanchezm1910@gmail.com')
   and p.is_admin is distinct from true;

-- ===========================================================================
-- 2. Anti-autoelevacion: triggers que no dependen del GUC de PostgREST
-- ===========================================================================
-- role: se fija en el alta y nunca es editable por el cliente.
-- is_admin: solo lo cambia un admin ya existente (via RPC) o una conexion sin
-- contexto de autenticacion (migracion / service_role). Un usuario autenticado
-- que NO es admin nunca puede modificar is_admin (ni el suyo ni el de otro).
create or replace function public.lock_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    new.role := old.role;
  end if;
  if new.is_admin is distinct from old.is_admin then
    if (select auth.uid()) is not null and not public.is_admin() then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.lock_org_approval_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    new.approval_status  := old.approval_status;
    new.is_active        := old.is_active;
    new.verified_at      := old.verified_at;
    new.verified_by      := old.verified_by;
    new.rejection_reason := old.rejection_reason;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 3. set_user_admin(): gestion de administradores (solo admin)
-- ===========================================================================
create or replace function public.set_user_admin(
  p_user_id uuid,
  p_make_admin boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_currently_admin boolean;
  v_admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  select is_admin into v_is_currently_admin from public.profiles where id = p_user_id;
  if v_is_currently_admin is null then
    raise exception 'El usuario no existe.';
  end if;

  -- Proteccion del ultimo administrador.
  if p_make_admin = false and v_is_currently_admin then
    select count(*) into v_admin_count from public.profiles where is_admin;
    if v_admin_count <= 1 then
      raise exception 'No puedes eliminar al ultimo administrador del sistema.';
    end if;
  end if;

  update public.profiles set is_admin = p_make_admin where id = p_user_id;
end;
$$;

revoke all on function public.set_user_admin(uuid, boolean) from public;
grant execute on function public.set_user_admin(uuid, boolean) to authenticated;

comment on function public.set_user_admin(uuid, boolean) is
  'Un admin convierte a un usuario existente en administrador, o le quita el rol. Protege al ultimo administrador.';

-- ===========================================================================
-- 4. set_org_active(): desactivar / reactivar una organizacion (solo admin)
-- ===========================================================================
create or replace function public.set_org_active(
  p_org_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  update public.organization_profiles set is_active = p_active where id = p_org_id;
  if not found then
    raise exception 'La organizacion no existe.';
  end if;
end;
$$;

revoke all on function public.set_org_active(uuid, boolean) from public;
grant execute on function public.set_org_active(uuid, boolean) to authenticated;

-- ===========================================================================
-- 5. admin_list_users(): incluir estado de confirmacion de la cuenta
-- ===========================================================================
drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  role text,
  is_admin boolean,
  confirmed_at timestamptz,
  pets_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  return query
    select p.id, p.display_name, p.first_name, p.last_name, u.email::text, p.phone,
           p.role::text, p.is_admin, u.email_confirmed_at,
           (select count(*) from public.pets pe where pe.owner_id = p.id and not pe.is_archived),
           p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.is_admin desc, p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;
