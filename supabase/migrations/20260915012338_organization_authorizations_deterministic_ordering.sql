-- `created_at` puede empatar entre filas insertadas en la misma transacción
-- (now() es constante dentro de una transacción en Postgres). Se agrega una
-- secuencia monotónica dedicada para que "la fila más reciente" sea siempre
-- determinista, sin depender de la resolución del reloj.
alter table public.organization_authorizations
  add column seq bigint generated always as identity;

create index organization_authorizations_seq_idx
  on public.organization_authorizations (organization_id, authorization_type, seq desc);

drop index if exists organization_authorizations_lookup_idx;

create or replace function public._org_authorization_status(p_org_id uuid, p_type text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.status from public.organization_authorizations a
  where a.organization_id = p_org_id and a.authorization_type = p_type
  order by a.seq desc
  limit 1
$$;

create or replace function public.my_organization_authorizations()
returns table(authorization_type text, status text, policy_version text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (a.authorization_type)
    a.authorization_type, a.status, a.policy_version, a.created_at
  from public.organization_authorizations a
  join public.organization_profiles o on o.id = a.organization_id
  where o.owner_id = (select auth.uid())
  order by a.authorization_type, a.seq desc
$$;
