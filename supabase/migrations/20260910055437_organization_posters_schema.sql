-- Huellas de Vuelta: modulo POSTERS.
--   * organization_posters: poster promocional/informativo de una veterinaria/fundacion,
--     visible en la Landing durante 24 h tras la aprobacion del administrador.
--   * organization_poster_events: bitacora append-only (auditoria + limite semanal
--     que sobrevive al borrado de un poster).
--   * Sin publicacion automatica: el admin aprueba, y expira solo por expires_at.
--
-- Reglas garantizadas en BD:
--   * Maximo 1 poster 'approved' por organizacion  -> indice unico parcial.
--   * Maximo 2 posters aprobados por organizacion en 7 dias (ventana movil)
--     -> se valida en la RPC de aprobacion contando eventos 'approved'.
--   * Duracion 24 h calculada en servidor: expires_at = approved_at + interval '24 hours'.
--   * Propiedad: organization_id SIEMPRE se deriva del auth.uid() del dueno en las RPC.

-- ---------------------------------------------------------------------------
-- 1. organization_posters
-- ---------------------------------------------------------------------------
create table public.organization_posters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization_profiles(id) on delete cascade,
  image_path text not null check (char_length(image_path) between 1 and 400),
  title text check (char_length(title) <= 80),
  description text check (char_length(description) <= 300),
  target_url text check (char_length(target_url) <= 500),
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'expired', 'inactive')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  approved_by uuid references public.profiles(id),
  rejection_reason text check (char_length(rejection_reason) <= 300),
  submitted_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_posters_approved_dates check (
    status <> 'approved' or (approved_at is not null and expires_at is not null)
  )
);

comment on table public.organization_posters is
  'Posters promocionales de veterinarias/fundaciones para la Landing. Aprobacion manual del admin; vigencia 24 h (expires_at). image_path apunta al bucket privado org-posters.';

create index organization_posters_org_idx
  on public.organization_posters (organization_id, created_at desc);
create index organization_posters_status_idx
  on public.organization_posters (status, submitted_at desc);
create index organization_posters_live_idx
  on public.organization_posters (expires_at)
  where status = 'approved';

-- REGLA: como maximo 1 poster 'approved' por organizacion a la vez.
create unique index organization_posters_one_live_per_org
  on public.organization_posters (organization_id)
  where status = 'approved';

create trigger organization_posters_set_updated_at
before update on public.organization_posters
for each row execute procedure public.set_updated_at();

alter table public.organization_posters enable row level security;

create policy "org_posters_owner_read"
on public.organization_posters for select to authenticated
using (
  organization_id in (
    select o.id from public.organization_profiles o where o.owner_id = (select auth.uid())
  )
);

create policy "org_posters_admin_read"
on public.organization_posters for select to authenticated
using (public.is_admin());

grant select on public.organization_posters to authenticated;

-- ---------------------------------------------------------------------------
-- 2. organization_poster_events (bitacora append-only)
-- ---------------------------------------------------------------------------
create table public.organization_poster_events (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid references public.organization_posters(id) on delete set null,
  organization_id uuid not null references public.organization_profiles(id) on delete cascade,
  event text not null check (event in (
    'created', 'submitted', 'approved', 'rejected', 'expired', 'deactivated', 'deleted'
  )),
  actor_id uuid references public.profiles(id),
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

comment on table public.organization_poster_events is
  'Bitacora inmutable de un poster (creado/enviado/aprobado/rechazado/vencido/desactivado/borrado). Fuente del limite semanal: sobrevive al borrado del poster.';

create index organization_poster_events_org_idx
  on public.organization_poster_events (organization_id, event, created_at desc);
create index organization_poster_events_poster_idx
  on public.organization_poster_events (poster_id, created_at desc);

alter table public.organization_poster_events enable row level security;

create policy "org_poster_events_owner_read"
on public.organization_poster_events for select to authenticated
using (
  organization_id in (
    select o.id from public.organization_profiles o where o.owner_id = (select auth.uid())
  )
);

create policy "org_poster_events_admin_read"
on public.organization_poster_events for select to authenticated
using (public.is_admin());

grant select on public.organization_poster_events to authenticated;

-- ---------------------------------------------------------------------------
-- 3. _expire_stale_posters(): reconcilia estado de posters vencidos.
-- ---------------------------------------------------------------------------
create or replace function public._expire_stale_posters(p_org_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    update public.organization_posters
       set status = 'expired'
     where status = 'approved'
       and expires_at <= now()
       and (p_org_id is null or organization_id = p_org_id)
    returning id, organization_id
  loop
    insert into public.organization_poster_events (poster_id, organization_id, event)
    values (v_row.id, v_row.organization_id, 'expired');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public._expire_stale_posters(uuid) from public;
grant execute on function public._expire_stale_posters(uuid) to authenticated;

comment on function public._expire_stale_posters(uuid) is
  'Pasa a expired los posters approved cuya expires_at ya paso y registra el evento. Se llama antes de aprobar y al abrir el panel de la organizacion.';

-- ---------------------------------------------------------------------------
-- 4. poster_object_is_public(): usada por la policy de Storage.
-- ---------------------------------------------------------------------------
create or replace function public.poster_object_is_public(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_posters p
    join public.organization_profiles o on o.id = p.organization_id
    where p.image_path = object_name
      and p.status = 'approved'
      and p.expires_at > now()
      and o.status = 'published'
      and o.approval_status = 'approved'
      and o.is_active
  )
$$;

revoke all on function public.poster_object_is_public(text) from public;
grant execute on function public.poster_object_is_public(text) to anon, authenticated;
