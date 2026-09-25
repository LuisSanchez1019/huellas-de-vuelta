-- Correccion de seguridad H-01: una organizacion NO puede autoaprobarse.
--
-- ANTES: la politica org_profiles_owner_all (ALL) dejaba al propietario hacer
-- SELECT/INSERT/UPDATE/DELETE de su fila en organization_profiles. El trigger
-- lock_org_approval_columns solo corria BEFORE UPDATE, asi que una cuenta podia
-- BORRAR su fila (pendiente) y VOLVER A INSERTARLA con approval_status='approved',
-- status='published' y un qr_prefix propio. _vet_caller() confia en esa fila
-- (profiles.role='veterinaria' + approval_status='approved' + is_active), por lo que
-- vet_identify_pet / vet_request_access / vet_emergency_access quedaban abiertas.
--
-- AHORA (defensa en la base de datos, no en el frontend):
--  1. El propietario ya no tiene DELETE (sin politica y sin privilegio) ni TRUNCATE.
--  2. INSERT y UPDATE del propietario siguen permitidos (el perfil se guarda con
--     upsert), pero el trigger corre tambien BEFORE INSERT y fuerza los valores
--     seguros: pending, sin verificacion, sin motivo de rechazo, sin qr_prefix.
--  3. Un trigger BEFORE DELETE impide que un usuario final borre la fila (el borrado
--     en cascada por eliminacion de cuenta corre sin JWT de usuario y sigue funcionando).
--  4. _vet_caller() exige ademas verified_at (solo lo escribe set_org_approval).
-- El administrador conserva set_org_approval / set_org_active / admin_set_provider_qr_prefix.

-- 1. Politicas granulares del propietario (sin DELETE).
drop policy if exists org_profiles_owner_all on public.organization_profiles;

create policy org_profiles_owner_select
on public.organization_profiles for select to authenticated
using (owner_id = (select auth.uid()));

create policy org_profiles_owner_insert
on public.organization_profiles for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy org_profiles_owner_update
on public.organization_profiles for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke delete, truncate on public.organization_profiles from anon, authenticated;

-- 2. El trigger de bloqueo tambien corre en INSERT.
create or replace function public.lock_org_approval_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      -- Alta hecha por un usuario final: siempre nace pendiente y sin verificar.
      new.approval_status  := 'pending';
      new.is_active        := true;
      new.verified_at      := null;
      new.verified_by      := null;
      new.rejection_reason := null;
      new.qr_prefix        := null;
    else
      new.approval_status  := old.approval_status;
      new.is_active        := old.is_active;
      new.verified_at      := old.verified_at;
      new.verified_by      := old.verified_by;
      new.rejection_reason := old.rejection_reason;
      new.qr_prefix        := old.qr_prefix;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.lock_org_approval_columns() from public, anon, authenticated;

drop trigger if exists organization_profiles_lock_approval on public.organization_profiles;
create trigger organization_profiles_lock_approval
before insert or update on public.organization_profiles
for each row execute function public.lock_org_approval_columns();

-- 3. Un usuario final no puede borrar la fila (defensa adicional a la politica/privilegio).
create or replace function public.guard_org_profile_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'ORG_DELETE_FORBIDDEN';
  end if;
  return old;
end;
$$;
revoke all on function public.guard_org_profile_delete() from public, anon, authenticated;

drop trigger if exists organization_profiles_guard_delete on public.organization_profiles;
create trigger organization_profiles_guard_delete
before delete on public.organization_profiles
for each row execute function public.guard_org_profile_delete();

-- 4. La veterinaria autorizada exige verificacion real (verified_at lo escribe solo
--    set_org_approval). Mismo contrato de retorno que antes.
create or replace function public._vet_caller(
  out out_user_id uuid, out out_org_id uuid, out out_org_name text, out out_user_name text
)
returns record
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select op.id, op.name into out_org_id, out_org_name
  from public.profiles pr
  join public.organization_profiles op on op.owner_id = pr.id
  where pr.id = v_uid
    and pr.role = 'veterinaria'
    and op.kind = 'veterinaria'
    and op.approval_status = 'approved'
    and op.verified_at is not null
    and op.is_active;

  if out_org_id is null then
    raise exception 'VET_NOT_AUTHORIZED';
  end if;

  out_user_id := v_uid;
  select coalesce(nullif(btrim(p2.display_name), ''), 'Profesional') into out_user_name
  from public.profiles p2 where p2.id = v_uid;
end;
$$;
