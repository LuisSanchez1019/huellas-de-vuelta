-- Huellas de Vuelta: prueba del consentimiento de la Politica de Tratamiento de
-- Datos Personales (Ley 1581/2012). OBLIGATORIO para crear una cuenta.
--
-- Separado de user_privacy_preferences (que son 3 permisos OPCIONALES opt-in):
-- aqui se guarda QUIEN acepto QUE politica, QUE version y CUANDO. Registros
-- inmutables (append-only): sin policy de UPDATE/DELETE y grants revocados.

-- Version vigente de la politica (fuente de verdad en BD). Debe coincidir con
-- DATA_POLICY_VERSION del frontend (src/lib/legal/policy.ts).
create or replace function public._current_data_policy_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '1.0'::text $$;

create table public.user_policy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_type text not null check (policy_type in ('data_processing')),
  policy_version text not null check (policy_version ~ '^[0-9]{1,3}\.[0-9]{1,3}$'),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, policy_type, policy_version)
);
comment on table public.user_policy_consents is
  'Prueba del consentimiento de la Politica de Tratamiento de Datos Personales. Append-only e inmutable: quien acepto, que tipo de politica, que version y cuando. No se sobrescribe el historico.';

create index user_policy_consents_user_idx
  on public.user_policy_consents (user_id, policy_type, accepted_at desc);

alter table public.user_policy_consents enable row level security;

-- El titular solo consulta SUS propios consentimientos.
create policy "upc_owner_read" on public.user_policy_consents for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.user_policy_consents to authenticated;
-- Inmutabilidad estructural: nadie (ni el titular ni el admin) inserta/edita/borra
-- por tabla. Solo el trigger handle_new_user y el RPC record_policy_consent
-- (SECURITY DEFINER, propiedad de postgres) escriben aqui.
revoke insert, update, delete on public.user_policy_consents from authenticated, anon;

-- ---------------------------------------------------------------------------
-- RPC: registrar el consentimiento del titular autenticado (re-consentimiento
-- de usuarios existentes y de futuras versiones). Solo la version vigente.
-- ---------------------------------------------------------------------------
create or replace function public.record_policy_consent(p_policy_type text, p_policy_version text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ver text := btrim(coalesce(p_policy_version, ''));
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_policy_type <> 'data_processing' then
    raise exception 'Tipo de politica no valido.';
  end if;
  if v_ver <> public._current_data_policy_version() then
    raise exception 'Version de politica no vigente.';
  end if;
  insert into public.user_policy_consents (user_id, policy_type, policy_version)
  values (v_uid, 'data_processing', v_ver)
  on conflict (user_id, policy_type, policy_version) do nothing;
end;
$$;
revoke all on function public.record_policy_consent(text, text) from public, anon;
grant execute on function public.record_policy_consent(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: historial de consentimientos del titular.
-- ---------------------------------------------------------------------------
create or replace function public.my_policy_consents()
returns table (policy_type text, policy_version text, accepted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.policy_type, c.policy_version, c.accepted_at
  from public.user_policy_consents c
  where c.user_id = (select auth.uid())
  order by c.accepted_at desc
$$;
revoke all on function public.my_policy_consents() from public, anon;
grant execute on function public.my_policy_consents() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: politica pendiente de aceptar por el titular (para el aviso de
-- re-consentimiento). Devuelve 0 filas si ya acepto la version vigente.
-- ---------------------------------------------------------------------------
create or replace function public.my_pending_policy_consent()
returns table (policy_type text, policy_version text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ver text := public._current_data_policy_version();
begin
  if v_uid is null then return; end if;
  if not exists (
    select 1 from public.user_policy_consents
    where user_id = v_uid and policy_type = 'data_processing' and policy_version = v_ver
  ) then
    return query select 'data_processing'::text, v_ver;
  end if;
end;
$$;
revoke all on function public.my_pending_policy_consent() from public, anon;
grant execute on function public.my_pending_policy_consent() to authenticated;
