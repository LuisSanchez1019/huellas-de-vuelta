-- ============================================================
-- Catálogo público de sectores empresariales (categorías DANE/CIIU
-- simplificadas, sin obligar a conocer códigos CIIU). Mismo patrón que
-- service_catalog: catálogo de solo lectura pública, sembrado por migración.
-- ============================================================
create table public.business_sectors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.business_sectors enable row level security;

create policy business_sectors_public_read
  on public.business_sectors for select
  to anon, authenticated
  using (true);

insert into public.business_sectors (slug, name, sort_order) values
  ('agricultura-ganaderia-silvicultura-pesca', 'Agricultura, ganadería, silvicultura y pesca', 10),
  ('explotacion-minas-canteras', 'Explotación de minas y canteras', 20),
  ('industrias-manufactureras', 'Industrias manufactureras', 30),
  ('electricidad-gas-servicios-publicos', 'Suministro de electricidad, gas y otros servicios públicos', 40),
  ('agua-saneamiento-residuos', 'Agua, saneamiento y gestión de residuos', 50),
  ('construccion', 'Construcción', 60),
  ('comercio', 'Comercio', 70),
  ('transporte-almacenamiento', 'Transporte y almacenamiento', 80),
  ('alojamiento-servicios-comida', 'Alojamiento y servicios de comida', 90),
  ('informacion-comunicaciones', 'Información y comunicaciones', 100),
  ('financieras-seguros', 'Actividades financieras y de seguros', 110),
  ('inmobiliarias', 'Actividades inmobiliarias', 120),
  ('profesionales-cientificas-tecnicas', 'Actividades profesionales, científicas y técnicas', 130),
  ('administrativos-apoyo', 'Servicios administrativos y de apoyo', 140),
  ('administracion-publica-defensa', 'Administración pública y defensa', 150),
  ('educacion', 'Educación', 160),
  ('salud-asistencia-social', 'Salud y asistencia social', 170),
  ('artisticas-entretenimiento-recreacion', 'Actividades artísticas, de entretenimiento y recreación', 180),
  ('otras-actividades-servicios', 'Otras actividades de servicios', 190),
  ('otro', 'Otro', 200);

-- ============================================================
-- Datos empresariales del aliado que aún no existen como columnas
-- reutilizables en organization_profiles (el resto — description, phone,
-- whatsapp, email, address, city, country, map_url, logo_url/path, social —
-- ya existe y se reutiliza sin cambios).
-- ============================================================
alter table public.organization_profiles
  add column legal_name text,
  add column mobile_phone text,
  add column sector_id uuid references public.business_sectors(id);

-- ============================================================
-- Historial de autorizaciones de publicación/uso de marca (append-only,
-- nunca se borra ni se actualiza: cada cambio es una fila nueva; el estado
-- vigente es la fila más reciente por organización + tipo).
-- ============================================================
create table public.organization_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization_profiles(id) on delete cascade,
  authorization_type text not null check (authorization_type in ('public_info','logo_usage')),
  policy_version text not null,
  status text not null check (status in ('granted','revoked')),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index organization_authorizations_lookup_idx
  on public.organization_authorizations (organization_id, authorization_type, created_at desc);

alter table public.organization_authorizations enable row level security;

-- Solo lectura del propio dueño (o admin); NINGUNA policy de insert/update/delete:
-- toda escritura pasa por `set_organization_authorization` (SECURITY DEFINER).
create policy organization_authorizations_owner_select
  on public.organization_authorizations for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.organization_profiles o
      where o.id = organization_authorizations.organization_id
        and o.owner_id = (select auth.uid())
    )
  );

-- ============================================================
-- Versión vigente de la Política de información y uso de marca de aliados
-- (mismo patrón que _current_data_policy_version()).
-- ============================================================
create or replace function public._current_ally_brand_policy_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '1.0'::text $$;

-- Estado vigente (última fila) de una autorización de una organización.
-- SECURITY DEFINER: se usa desde RLS y RPCs públicas, y debe poder leer
-- organization_authorizations sin importar quién hace la consulta original.
create or replace function public._org_authorization_status(p_org_id uuid, p_type text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.status from public.organization_authorizations a
  where a.organization_id = p_org_id and a.authorization_type = p_type
  order by a.created_at desc
  limit 1
$$;

-- Refuerza la policy pública existente: un aliado (kind='aliado') solo es
-- visible por lectura pública (anon/authenticated, fuera del dueño) si además
-- tiene autorización de publicación vigente. Veterinaria/fundación no usan
-- este sistema de autorizaciones y no cambian de comportamiento.
drop policy org_profiles_public_read on public.organization_profiles;
create policy org_profiles_public_read
  on public.organization_profiles for select
  to anon, authenticated
  using (
    status = 'published' and approval_status = 'approved' and is_active
    and (kind <> 'aliado' or public._org_authorization_status(id, 'public_info') = 'granted')
  );

-- Autorizaciones vigentes (una por tipo) de la cuenta aliada autenticada.
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
  order by a.authorization_type, a.created_at desc
$$;

-- Otorga/revoca una autorización (siempre inserta una fila nueva: historial
-- inmutable). Solo aplica a la cuenta aliada autenticada dueña del perfil.
create or replace function public.set_organization_authorization(p_type text, p_granted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_org_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_type not in ('public_info','logo_usage') then
    raise exception 'Tipo de autorizacion no valido.';
  end if;

  select id into v_org_id from public.organization_profiles
  where owner_id = v_uid and kind = 'aliado';
  if not found then raise exception 'Primero crea el perfil de tu empresa.'; end if;

  insert into public.organization_authorizations
    (organization_id, authorization_type, policy_version, status, actor_id)
  values
    (v_org_id, p_type, public._current_ally_brand_policy_version(),
     case when p_granted then 'granted' else 'revoked' end, v_uid);
end;
$function$;

-- ============================================================
-- Landing: lista pública de aliados vigentes, ahora exigiendo también
-- autorización de publicación (public_info='granted') y devolviendo los
-- campos enriquecidos para tarjeta + modal. El logo (imagen) solo se
-- devuelve si además hay autorización específica de uso de logo.
-- ============================================================
drop function if exists public.list_public_active_allies();

create function public.list_public_active_allies()
returns table(
  id uuid,
  name text,
  description text,
  sector_name text,
  website text,
  country text,
  city text,
  address text,
  email text,
  phone text,
  mobile_phone text,
  whatsapp text,
  map_url text,
  logo_url text,
  logo_path text,
  logo_authorized boolean,
  end_date date
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    o.id,
    o.name,
    o.description,
    bs.name as sector_name,
    o.social ->> 'website' as website,
    o.country,
    o.city,
    o.address,
    o.email,
    o.phone,
    o.mobile_phone,
    o.whatsapp,
    o.map_url,
    case when public._org_authorization_status(o.id, 'logo_usage') = 'granted' then o.logo_url else null end,
    case when public._org_authorization_status(o.id, 'logo_usage') = 'granted' then o.logo_path else null end,
    public._org_authorization_status(o.id, 'logo_usage') = 'granted' as logo_authorized,
    v.end_date
  from public.organization_profiles o
  join lateral (
    select av.end_date from public.aliado_visibility_orders av
    where av.org_id = o.id and av.payment_status = 'approved' and av.end_date >= current_date
    order by av.end_date desc limit 1
  ) v on true
  left join public.business_sectors bs on bs.id = o.sector_id
  where o.kind = 'aliado' and o.status = 'published' and o.approval_status = 'approved' and o.is_active
    and public._org_authorization_status(o.id, 'public_info') = 'granted'
  order by o.name
$function$;

grant execute on function public.my_organization_authorizations() to authenticated;
grant execute on function public.set_organization_authorization(text, boolean) to authenticated;
