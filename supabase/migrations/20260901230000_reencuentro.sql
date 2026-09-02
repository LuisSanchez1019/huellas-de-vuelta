-- Huellas de Vuelta: sistema de REENCUENTRO de mascotas perdidas.
--   * profiles.is_admin + is_admin(): rol administrador para aprobar organizaciones
--   * organization_profiles: category + estado de aprobacion/verificacion + is_active
--   * pet_reports.stage: etapa informativa del caso (la mascota sigue 'lost')
--   * pet_report_events: avistamientos y avisos de encuentro ligados al reporte (append-only)
--   * notifications: avisos para el propietario
--   * submit_report_event(): unica via de escritura para quien encuentra la mascota (sin cuenta)
--   * list_help_organizations(): organizaciones aprobadas para "busca ayuda cerca de ti"
--   * bucket report-evidence: foto opcional del hallazgo, subida anonima restringida
--
-- Nota: con `search_path = ''` los objetos de public/auth/storage se califican por
-- esquema; las funciones de pg_catalog (coalesce, nullif, trim, left, count, now,
-- split_part, lower, ...) se resuelven siempre de forma implicita y NO se califican.

-- ===========================================================================
-- A1. Rol admin
-- ===========================================================================
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Administrador de Huellas de Vuelta. Se activa solo con SQL directo / service_role.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  )
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Los admin pueden leer todos los perfiles (para /admin/usuarios).
drop policy if exists "profiles_admin_read" on public.profiles;
create policy "profiles_admin_read"
on public.profiles for select to authenticated
using (public.is_admin());

-- El rol ya estaba bloqueado; ahora tambien is_admin: solo lo cambia un admin
-- existente o una conexion sin JWT (SQL directo / service_role).
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
    if current_setting('request.jwt.claims', true) is not null
       and not public.is_admin() then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- A2. Organizaciones: categoria + aprobacion / verificacion
-- ===========================================================================
alter table public.organization_profiles
  add column if not exists category text not null default 'fundacion'
    check (category in ('veterinaria', 'fundacion', 'refugio', 'otro_aliado')),
  add column if not exists neighborhood text check (char_length(neighborhood) <= 80),
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists is_active boolean not null default true,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id),
  add column if not exists rejection_reason text check (char_length(rejection_reason) <= 300);

-- Backfill: la categoria arranca igual que el kind de la cuenta.
update public.organization_profiles set category = kind where category is distinct from kind;

comment on column public.organization_profiles.category is
  'Categoria mostrada al publico: veterinaria | fundacion | refugio | otro_aliado. El kind sigue atado al rol de la cuenta.';
comment on column public.organization_profiles.approval_status is
  'Aprobacion de Huellas de Vuelta. Solo aparece en publico si approved + is_active + status=published.';

-- Visibilidad publica: publicada Y aprobada Y activa.
drop policy if exists "org_profiles_public_read" on public.organization_profiles;
create policy "org_profiles_public_read"
on public.organization_profiles for select to anon, authenticated
using (status = 'published' and approval_status = 'approved' and is_active);

-- El dueno no puede tocar las columnas de aprobacion (salvo admin / SQL directo).
create or replace function public.lock_org_approval_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('request.jwt.claims', true) is not null
     and not public.is_admin() then
    new.approval_status  := old.approval_status;
    new.is_active        := old.is_active;
    new.verified_at      := old.verified_at;
    new.verified_by      := old.verified_by;
    new.rejection_reason := old.rejection_reason;
  end if;
  return new;
end;
$$;

drop trigger if exists organization_profiles_lock_approval on public.organization_profiles;
create trigger organization_profiles_lock_approval
before update on public.organization_profiles
for each row execute procedure public.lock_org_approval_columns();

-- Accion de aprobacion (solo admin).
create or replace function public.set_org_approval(
  p_org_id uuid,
  p_status text,
  p_reason text default null
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
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Estado de aprobacion no valido: %', p_status;
  end if;
  update public.organization_profiles
    set approval_status  = p_status,
        verified_at      = now(),
        verified_by      = (select auth.uid()),
        rejection_reason = case when p_status = 'rejected'
          then nullif(left(btrim(coalesce(p_reason, '')), 300), '')
          else null end
    where id = p_org_id;
  if not found then
    raise exception 'La organizacion no existe.';
  end if;
end;
$$;

revoke all on function public.set_org_approval(uuid, text, text) from public;
grant execute on function public.set_org_approval(uuid, text, text) to authenticated;

-- Lista completa de organizaciones para la cola de aprobacion del admin.
create or replace function public.admin_list_organizations()
returns table (
  id uuid,
  owner_id uuid,
  owner_display_name text,
  owner_email text,
  kind text,
  category text,
  name text,
  slug text,
  description text,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  neighborhood text,
  lat double precision,
  lng double precision,
  status text,
  approval_status text,
  is_active boolean,
  verified_at timestamptz,
  rejection_reason text,
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
    select o.id, o.owner_id, p.display_name, u.email::text,
           o.kind, o.category, o.name, o.slug, o.description,
           o.phone, o.whatsapp, o.email, o.address, o.city, o.neighborhood,
           o.lat, o.lng, o.status, o.approval_status, o.is_active,
           o.verified_at, o.rejection_reason, o.created_at
    from public.organization_profiles o
    join public.profiles p on p.id = o.owner_id
    left join auth.users u on u.id = o.owner_id
    order by
      case o.approval_status when 'pending' then 0 when 'approved' then 1 else 2 end,
      o.created_at desc;
end;
$$;

revoke all on function public.admin_list_organizations() from public;
grant execute on function public.admin_list_organizations() to authenticated;

-- Contadores para el panel admin.
create or replace function public.admin_counts()
returns table (users bigint, pets bigint, active_reports bigint, pending_orgs bigint)
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
    select
      (select count(*) from public.profiles),
      (select count(*) from public.pets where not is_archived),
      (select count(*) from public.pet_reports where status = 'active'),
      (select count(*) from public.organization_profiles where approval_status = 'pending');
end;
$$;

revoke all on function public.admin_counts() from public;
grant execute on function public.admin_counts() to authenticated;

-- Lista de usuarios para /admin/usuarios (solo lectura).
create or replace function public.admin_list_users()
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  role text,
  is_admin boolean,
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
           p.role::text, p.is_admin,
           (select count(*) from public.pets pe where pe.owner_id = p.id and not pe.is_archived),
           p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- ===========================================================================
-- A3. pet_reports: etapa informativa del caso
-- ===========================================================================
alter table public.pet_reports
  add column if not exists stage text not null default 'reported'
    check (stage in ('reported', 'sighted', 'in_contact', 'in_organization'));

comment on column public.pet_reports.stage is
  'Etapa informativa del caso. La mascota sigue pet_status = lost hasta que el propietario confirme.';

-- ===========================================================================
-- A4. pet_report_events: avistamientos + avisos de encuentro (append-only)
-- ===========================================================================
create table public.pet_report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.pet_reports(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('sighting', 'found', 'found_needs_help')),
  city text not null check (char_length(city) between 1 and 80),
  neighborhood text not null check (char_length(neighborhood) between 1 and 80),
  happened_on date,
  happened_at_approx text check (char_length(happened_at_approx) <= 20),
  description text check (char_length(description) <= 400),
  pet_condition text check (pet_condition in ('ok', 'scared', 'injured', 'needs_attention')),
  finder_name text check (char_length(finder_name) <= 80),
  finder_contact text check (char_length(finder_contact) <= 120),
  selected_org_id uuid references public.organization_profiles(id) on delete set null,
  selected_org_at timestamptz,
  org_received_at timestamptz,
  org_received_note text check (char_length(org_received_note) <= 300),
  photo_path text check (char_length(photo_path) <= 255),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index pet_report_events_report_idx on public.pet_report_events(report_id, created_at desc);
create index pet_report_events_owner_idx on public.pet_report_events(owner_id, acknowledged_at);

alter table public.pet_report_events enable row level security;

-- Solo el dueno del reporte (o un admin) lee los eventos. Contiene el contacto
-- privado de quien encontro la mascota: nunca se expone en publico.
create policy "pet_report_events_owner_read"
on public.pet_report_events for select to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy "pet_report_events_owner_update"
on public.pet_report_events for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
-- Sin politica INSERT: se inserta solo via submit_report_event() (security definer).

grant select, update on public.pet_report_events to authenticated;

comment on table public.pet_report_events is
  'Avistamientos y avisos de encuentro ligados a un pet_reports. Append-only. finder_contact es privado (solo dueno/admin).';

-- ===========================================================================
-- A5. notifications
-- ===========================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('event_sighting', 'event_found', 'event_found_needs_help')),
  report_id uuid references public.pet_reports(id) on delete cascade,
  event_id uuid references public.pet_report_events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text check (char_length(body) <= 400),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_owner_read"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create policy "notifications_owner_update"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
-- Sin INSERT: las crea submit_report_event() (security definer).

grant select, update on public.notifications to authenticated;

-- ===========================================================================
-- A6. RPCs publicos
-- ===========================================================================

-- get_public_pet(): ahora tambien devuelve la ubicacion del reporte activo si esta perdida.
drop function if exists public.get_public_pet(text);
create function public.get_public_pet(p_public_id text)
returns table (
  public_id text,
  name text,
  species text,
  species_other text,
  breed text,
  color_primary text,
  color_secondary text,
  color_tertiary text,
  age_value integer,
  age_unit text,
  sex text,
  description text,
  status text,
  photo_path text,
  report_id uuid,
  report_stage text,
  lost_city text,
  lost_neighborhood text,
  lost_details text,
  reported_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.public_id, p.name, p.species, p.species_other, p.breed,
         p.color_primary, p.color_secondary, p.color_tertiary,
         p.age_value, p.age_unit, p.sex, p.description, p.status::text, p.photo_path,
         r.id, r.stage, r.city, r.neighborhood, r.details, r.created_at
  from public.pets p
  left join public.pet_reports r
    on r.pet_id = p.id and r.status = 'active' and p.status = 'lost'
  where p.public_id = p_public_id and not p.is_archived
$$;

revoke all on function public.get_public_pet(text) from public;
grant execute on function public.get_public_pet(text) to anon, authenticated;

comment on function public.get_public_pet(text) is
  'Datos publicos de una mascota por su public_id (QR / landing). No expone owner_id ni contacto.';

-- list_public_lost_pets(): ahora incluye public_id para enlazar a /m/<public_id>.
drop function if exists public.list_public_lost_pets();
create function public.list_public_lost_pets()
returns table (
  report_id uuid,
  public_id text,
  name text,
  species text,
  species_other text,
  breed text,
  age_value integer,
  age_unit text,
  sex text,
  color_primary text,
  color_secondary text,
  color_tertiary text,
  city text,
  neighborhood text,
  details text,
  photo_path text,
  reported_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.public_id, p.name, p.species, p.species_other, p.breed,
         p.age_value, p.age_unit, p.sex,
         p.color_primary, p.color_secondary, p.color_tertiary,
         r.city, r.neighborhood, r.details, p.photo_path, r.created_at
  from public.pet_reports r
  join public.pets p on p.id = r.pet_id
  where r.status = 'active' and r.kind = 'lost' and not p.is_archived
  order by r.created_at desc
  limit 60
$$;

revoke all on function public.list_public_lost_pets() from public;
grant execute on function public.list_public_lost_pets() to anon, authenticated;

-- submit_report_event(): unica via de escritura para quien encuentra la mascota.
create or replace function public.submit_report_event(
  p_public_id text,
  p_type text,
  p_city text,
  p_neighborhood text,
  p_happened_on date default null,
  p_happened_at_approx text default null,
  p_description text default null,
  p_pet_condition text default null,
  p_finder_name text default null,
  p_finder_contact text default null,
  p_selected_org_id uuid default null,
  p_photo_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pet_id uuid;
  v_owner uuid;
  v_report_id uuid;
  v_stage text;
  v_org_id uuid := null;
  v_event_id uuid;
  v_recent integer;
  v_total integer;
  v_new_stage text;
  v_rank_new integer;
  v_rank_cur integer;
  v_prefix text;
begin
  if p_type not in ('sighting', 'found', 'found_needs_help') then
    raise exception 'Tipo de aviso no valido.';
  end if;
  if coalesce(btrim(p_city), '') = '' or coalesce(btrim(p_neighborhood), '') = '' then
    raise exception 'La ciudad y la zona son obligatorias.';
  end if;
  if p_type in ('found', 'found_needs_help')
     and coalesce(btrim(p_finder_contact), '') = '' then
    raise exception 'Indica un medio de contacto para que la familia pueda comunicarse contigo.';
  end if;
  if p_pet_condition is not null
     and p_pet_condition not in ('ok', 'scared', 'injured', 'needs_attention') then
    raise exception 'Estado de la mascota no valido.';
  end if;

  select p.id, r.owner_id, r.id, r.stage
    into v_pet_id, v_owner, v_report_id, v_stage
  from public.pets p
  join public.pet_reports r
    on r.pet_id = p.id and r.status = 'active' and r.kind = 'lost'
  where p.public_id = p_public_id and not p.is_archived
  limit 1;

  if v_report_id is null then
    raise exception 'Esta mascota no tiene un reporte de busqueda activo.';
  end if;

  -- Anti-abuso.
  select count(*) into v_recent
  from public.pet_report_events
  where report_id = v_report_id and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Demasiados avisos recientes para esta mascota. Intenta de nuevo mas tarde.';
  end if;
  select count(*) into v_total
  from public.pet_report_events where report_id = v_report_id;
  if v_total >= 40 then
    raise exception 'Este reporte alcanzo el maximo de avisos registrados.';
  end if;

  -- La organizacion elegida solo se conserva si esta aprobada y visible.
  if p_type = 'found_needs_help' and p_selected_org_id is not null then
    select o.id into v_org_id
    from public.organization_profiles o
    where o.id = p_selected_org_id
      and o.status = 'published' and o.approval_status = 'approved' and o.is_active;
  end if;

  if p_photo_path is not null then
    v_prefix := 'reports/' || v_report_id::text || '/';
    if left(p_photo_path, length(v_prefix)) <> v_prefix then
      raise exception 'Ruta de foto no valida.';
    end if;
  end if;

  insert into public.pet_report_events (
    report_id, pet_id, owner_id, type, city, neighborhood,
    happened_on, happened_at_approx, description, pet_condition,
    finder_name, finder_contact, selected_org_id, selected_org_at, photo_path
  ) values (
    v_report_id, v_pet_id, v_owner, p_type,
    btrim(p_city), btrim(p_neighborhood),
    p_happened_on,
    nullif(left(btrim(coalesce(p_happened_at_approx, '')), 20), ''),
    nullif(left(btrim(coalesce(p_description, '')), 400), ''),
    p_pet_condition,
    nullif(left(btrim(coalesce(p_finder_name, '')), 80), ''),
    nullif(left(btrim(coalesce(p_finder_contact, '')), 120), ''),
    v_org_id,
    case when v_org_id is not null then now() else null end,
    p_photo_path
  )
  returning id into v_event_id;

  -- Avanzar la etapa del caso (nunca retrocede).
  v_new_stage := case p_type
    when 'sighting' then 'sighted'
    when 'found' then 'in_contact'
    when 'found_needs_help' then case when v_org_id is not null then 'in_organization' else 'in_contact' end
  end;
  v_rank_new := case v_new_stage when 'sighted' then 1 when 'in_contact' then 2 when 'in_organization' then 3 else 0 end;
  v_rank_cur := case v_stage when 'sighted' then 1 when 'in_contact' then 2 when 'in_organization' then 3 else 0 end;
  if v_rank_new > v_rank_cur then
    update public.pet_reports set stage = v_new_stage where id = v_report_id;
  end if;

  -- Notificar al propietario (sin datos privados del finder).
  insert into public.notifications (user_id, type, report_id, event_id, title, body)
  values (
    v_owner,
    case p_type when 'sighting' then 'event_sighting'
                when 'found' then 'event_found'
                else 'event_found_needs_help' end,
    v_report_id, v_event_id,
    case p_type
      when 'sighting' then 'Alguien vio a tu mascota'
      when 'found' then 'Alguien tiene posiblemente a tu mascota'
      else 'Alguien tiene a tu mascota y busca ayuda'
    end,
    'Zona: ' || btrim(p_city) || ' - ' || btrim(p_neighborhood)
      || '. Revisa el aviso en Mis reportes.'
  );

  return v_event_id;
end;
$$;

revoke all on function public.submit_report_event(text, text, text, text, date, text, text, text, text, text, uuid, text) from public;
grant execute on function public.submit_report_event(text, text, text, text, date, text, text, text, text, text, uuid, text) to anon, authenticated;

comment on function public.submit_report_event is
  'Registra un avistamiento o aviso de encuentro para el reporte activo de una mascota. Sin cuenta. No crea otra mascota ni otro reporte.';

-- list_help_organizations(): organizaciones aprobadas para "busca ayuda cerca de ti".
create or replace function public.list_help_organizations(p_city text default null)
returns table (
  id uuid,
  name text,
  category text,
  kind text,
  description text,
  address text,
  city text,
  neighborhood text,
  phone text,
  whatsapp text,
  hours jsonb,
  map_url text,
  lat double precision,
  lng double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.category, o.kind, o.description, o.address, o.city, o.neighborhood,
         o.phone, o.whatsapp, o.hours, o.map_url, o.lat, o.lng
  from public.organization_profiles o
  where o.status = 'published' and o.approval_status = 'approved' and o.is_active
  order by
    (p_city is not null and lower(o.city) = lower(btrim(p_city))) desc,
    o.name
$$;

revoke all on function public.list_help_organizations(text) from public;
grant execute on function public.list_help_organizations(text) to anon, authenticated;

-- ===========================================================================
-- A7. Storage: bucket report-evidence (foto opcional del hallazgo)
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-evidence', 'report-evidence', false, 3145728,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.report_accepts_evidence(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pet_reports r
    where r.status = 'active'
      and r.id = nullif(split_part(object_name, '/', 2), '')::uuid
  )
$$;

revoke all on function public.report_accepts_evidence(text) from public;
grant execute on function public.report_accepts_evidence(text) to anon, authenticated;

create or replace function public.can_read_report_evidence(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pet_reports r
    where r.id = nullif(split_part(object_name, '/', 2), '')::uuid
      and (r.owner_id = (select auth.uid()) or public.is_admin())
  )
$$;

revoke all on function public.can_read_report_evidence(text) from public;
grant execute on function public.can_read_report_evidence(text) to authenticated;

drop policy if exists "report_evidence_insert_anon" on storage.objects;
create policy "report_evidence_insert_anon"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'report-evidence'
  and name like 'reports/%'
  and public.report_accepts_evidence(name)
);

drop policy if exists "report_evidence_read_owner" on storage.objects;
create policy "report_evidence_read_owner"
on storage.objects for select to authenticated
using (bucket_id = 'report-evidence' and public.can_read_report_evidence(name));
