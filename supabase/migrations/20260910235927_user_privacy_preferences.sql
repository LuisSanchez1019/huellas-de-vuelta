-- Huellas de Vuelta: preferencias de privacidad del titular (Ley 1581 de 2012).
-- Cada finalidad es una autorizacion INDEPENDIENTE y OPT-IN (por defecto false).
-- Fuente de verdad = esta tabla (nunca localStorage). Toda escritura por RPC.
-- El admin NO obtiene acceso global: RLS limita a user_id = auth.uid().

create table public.user_privacy_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  -- Finalidad: una veterinaria/fundacion que YA recibio la mascota del titular
  -- puede consultar sus datos de contacto para coordinar la entrega.
  allow_org_contact_access boolean not null default false,
  -- Finalidad: mostrar el telefono del titular en el perfil publico de la
  -- mascota MIENTRAS este reportada como perdida.
  allow_public_phone boolean not null default false,
  -- Finalidad: si el titular reporta que encontro una mascota ajena, autoriza a
  -- compartir su contacto con el propietario para facilitar el reencuentro.
  allow_found_pet_contact_sharing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_privacy_preferences is
  'Autorizaciones de tratamiento de datos del titular (Ley 1581/2012). Opt-in, independientes, por defecto false. Solo el titular las consulta/modifica.';

create trigger user_privacy_preferences_set_updated_at
before update on public.user_privacy_preferences
for each row execute procedure public.set_updated_at();

alter table public.user_privacy_preferences enable row level security;
create policy "upp_owner_read" on public.user_privacy_preferences for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.user_privacy_preferences to authenticated;

-- Auditoria de cambios de autorizaciones.
create table public.user_privacy_preference_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  preference text not null check (preference in
    ('allow_org_contact_access','allow_public_phone','allow_found_pet_contact_sharing')),
  old_value boolean,
  new_value boolean not null,
  created_at timestamptz not null default now()
);
comment on table public.user_privacy_preference_events is
  'Bitacora append-only: quien, que autorizacion, valor anterior, valor nuevo, cuando. Permite demostrar cuando se otorgo o retiro una autorizacion.';
create index user_privacy_preference_events_idx
  on public.user_privacy_preference_events (user_id, created_at desc);

alter table public.user_privacy_preference_events enable row level security;
create policy "uppe_owner_read" on public.user_privacy_preference_events for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.user_privacy_preference_events to authenticated;

-- RPC: leer (creando la fila por defecto si no existe)
create or replace function public.my_privacy_preferences()
returns table (
  allow_org_contact_access boolean,
  allow_public_phone boolean,
  allow_found_pet_contact_sharing boolean,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.user_privacy_preferences (user_id) values (v_uid)
  on conflict (user_id) do nothing;
  return query
  select p.allow_org_contact_access, p.allow_public_phone,
         p.allow_found_pet_contact_sharing, p.updated_at
  from public.user_privacy_preferences p where p.user_id = v_uid;
end;
$$;
revoke all on function public.my_privacy_preferences() from public, anon;
grant execute on function public.my_privacy_preferences() to authenticated;

-- RPC: actualizar (registra en la bitacora cada flag que cambia)
create or replace function public.update_my_privacy_preferences(
  p_allow_org_contact_access boolean,
  p_allow_public_phone boolean,
  p_allow_found_pet_contact_sharing boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_old record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  insert into public.user_privacy_preferences (user_id) values (v_uid)
  on conflict (user_id) do nothing;

  select allow_org_contact_access, allow_public_phone, allow_found_pet_contact_sharing
    into v_old
  from public.user_privacy_preferences where user_id = v_uid for update;

  if v_old.allow_org_contact_access is distinct from coalesce(p_allow_org_contact_access, false) then
    insert into public.user_privacy_preference_events (user_id, preference, old_value, new_value)
    values (v_uid, 'allow_org_contact_access', v_old.allow_org_contact_access, coalesce(p_allow_org_contact_access, false));
  end if;
  if v_old.allow_public_phone is distinct from coalesce(p_allow_public_phone, false) then
    insert into public.user_privacy_preference_events (user_id, preference, old_value, new_value)
    values (v_uid, 'allow_public_phone', v_old.allow_public_phone, coalesce(p_allow_public_phone, false));
  end if;
  if v_old.allow_found_pet_contact_sharing is distinct from coalesce(p_allow_found_pet_contact_sharing, false) then
    insert into public.user_privacy_preference_events (user_id, preference, old_value, new_value)
    values (v_uid, 'allow_found_pet_contact_sharing', v_old.allow_found_pet_contact_sharing, coalesce(p_allow_found_pet_contact_sharing, false));
  end if;

  update public.user_privacy_preferences
     set allow_org_contact_access = coalesce(p_allow_org_contact_access, false),
         allow_public_phone = coalesce(p_allow_public_phone, false),
         allow_found_pet_contact_sharing = coalesce(p_allow_found_pet_contact_sharing, false)
   where user_id = v_uid;
end;
$$;
revoke all on function public.update_my_privacy_preferences(boolean, boolean, boolean) from public, anon;
grant execute on function public.update_my_privacy_preferences(boolean, boolean, boolean) to authenticated;
