-- Modelo de calculo dinamico de visibilidad paga para aliados: dias x tarifa
-- diaria vigente. Sin pasarela real todavia: el pago se confirma manualmente
-- por un administrador (mismo mecanismo ya usado en plate_payments/posters).
-- El valor aplicado queda congelado en cada solicitud (no se recalcula el
-- historico si el admin cambia la tarifa mas adelante).

-- ---------------------------------------------------------------------------
-- Configuracion (fila unica). El aliado NUNCA puede escribir aqui: solo
-- lectura via RPC, escritura solo por RPC de administrador.
-- ---------------------------------------------------------------------------
create table public.aliado_visibility_settings (
  id boolean primary key default true check (id),
  daily_rate integer not null check (daily_rate > 0),
  min_days integer not null check (min_days > 0),
  max_days integer not null check (max_days >= min_days),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
comment on table public.aliado_visibility_settings is 'Fila unica: tarifa diaria y limites de dias para la visibilidad paga de aliados. Protegida: sin acceso directo, solo via RPC.';
insert into public.aliado_visibility_settings (id, daily_rate, min_days, max_days) values (true, 3350, 15, 365);

alter table public.aliado_visibility_settings enable row level security;
revoke all on public.aliado_visibility_settings from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Solicitudes de visibilidad. El aliado ve solo las suyas; toda escritura pasa
-- por RPC (nunca insert/update directo desde el cliente).
-- ---------------------------------------------------------------------------
create table public.aliado_visibility_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organization_profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  days integer not null check (days > 0),
  daily_rate_applied integer not null check (daily_rate_applied > 0),
  total_amount integer not null check (total_amount > 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','approved','rejected','cancelled')),
  payment_reference text,
  start_date date,
  end_date date,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.aliado_visibility_orders is 'Solicitud de visibilidad paga de un aliado (dias x tarifa vigente al momento de la solicitud). Sin pasarela real: paymentStatus se confirma manualmente por un administrador. start_date/end_date solo se fijan al aprobar el pago.';

create index aliado_visibility_orders_org_idx on public.aliado_visibility_orders (org_id, created_at desc);
create index aliado_visibility_orders_owner_idx on public.aliado_visibility_orders (owner_id, created_at desc);

alter table public.aliado_visibility_orders enable row level security;
create policy "avo_owner_read" on public.aliado_visibility_orders for select to authenticated
  using (owner_id = (select auth.uid()));
grant select on public.aliado_visibility_orders to authenticated;
revoke insert, update, delete on public.aliado_visibility_orders from authenticated, anon;

-- ---------------------------------------------------------------------------
-- RPC: configuracion vigente (solo lectura).
-- ---------------------------------------------------------------------------
create or replace function public.aliado_visibility_settings_current()
returns table (daily_rate integer, min_days integer, max_days integer)
language sql
stable
security definer
set search_path = ''
as $$
  select daily_rate, min_days, max_days from public.aliado_visibility_settings where id = true
$$;
revoke all on function public.aliado_visibility_settings_current() from public, anon;
grant execute on function public.aliado_visibility_settings_current() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: cotizacion server-side. Nunca confiar en el total calculado por el
-- navegador: esto es lo que se vuelve a calcular antes de cualquier operacion.
-- ---------------------------------------------------------------------------
create or replace function public.aliado_visibility_quote(p_days integer)
returns table (days integer, daily_rate integer, total_amount integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings record;
begin
  select * into v_settings from public.aliado_visibility_settings where id = true;
  if p_days is null or p_days < v_settings.min_days or p_days > v_settings.max_days then
    raise exception 'Los dias deben estar entre % y %.', v_settings.min_days, v_settings.max_days;
  end if;
  return query select p_days, v_settings.daily_rate, p_days * v_settings.daily_rate;
end;
$$;
revoke all on function public.aliado_visibility_quote(integer) from public, anon;
grant execute on function public.aliado_visibility_quote(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: crear solicitud (queda 'pending'). NO activa nada publicamente.
-- ---------------------------------------------------------------------------
create or replace function public.aliado_visibility_request_create(p_days integer)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org record;
  v_settings record;
  v_total integer;
  v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_org from public.organization_profiles where owner_id = v_uid and kind = 'aliado';
  if not found then raise exception 'Primero crea el perfil de tu empresa.'; end if;

  select * into v_settings from public.aliado_visibility_settings where id = true;
  if p_days is null or p_days < v_settings.min_days or p_days > v_settings.max_days then
    raise exception 'Los dias deben estar entre % y %.', v_settings.min_days, v_settings.max_days;
  end if;
  v_total := p_days * v_settings.daily_rate;

  insert into public.aliado_visibility_orders (org_id, owner_id, days, daily_rate_applied, total_amount)
  values (v_org.id, v_uid, p_days, v_settings.daily_rate, v_total)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.aliado_visibility_request_create(integer) from public, anon;
grant execute on function public.aliado_visibility_request_create(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: historial propio con estado calculado (vigente/vencido), sin cron.
-- ---------------------------------------------------------------------------
create or replace function public.my_aliado_visibility_orders()
returns table (
  id uuid, days integer, daily_rate_applied integer, total_amount integer,
  payment_status text, payment_reference text,
  start_date date, end_date date, requested_at timestamptz, computed_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.days, o.daily_rate_applied, o.total_amount,
         o.payment_status, o.payment_reference, o.start_date, o.end_date, o.requested_at,
         case
           when o.payment_status = 'approved' and o.end_date >= current_date then 'vigente'
           when o.payment_status = 'approved' and o.end_date < current_date then 'vencido'
           else o.payment_status
         end as computed_status
  from public.aliado_visibility_orders o
  where o.owner_id = (select auth.uid())
  order by o.requested_at desc
$$;
revoke all on function public.my_aliado_visibility_orders() from public, anon;
grant execute on function public.my_aliado_visibility_orders() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC admin: listado completo.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_aliado_visibility_orders()
returns table (
  id uuid, org_id uuid, org_name text, owner_email text,
  days integer, daily_rate_applied integer, total_amount integer,
  payment_status text, payment_reference text,
  start_date date, end_date date, requested_at timestamptz, computed_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  return query
    select o.id, o.org_id, org.name, u.email::text,
           o.days, o.daily_rate_applied, o.total_amount,
           o.payment_status, o.payment_reference, o.start_date, o.end_date, o.requested_at,
           case
             when o.payment_status = 'approved' and o.end_date >= current_date then 'vigente'
             when o.payment_status = 'approved' and o.end_date < current_date then 'vencido'
             else o.payment_status
           end
    from public.aliado_visibility_orders o
    join public.organization_profiles org on org.id = o.org_id
    left join auth.users u on u.id = o.owner_id
    order by
      case o.payment_status when 'pending' then 0 else 1 end,
      o.requested_at desc;
end;
$$;
revoke all on function public.admin_list_aliado_visibility_orders() from public, anon;
grant execute on function public.admin_list_aliado_visibility_orders() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC admin: confirmar/rechazar/cancelar manualmente (sin pasarela real).
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_aliado_visibility_payment(p_order_id uuid, p_status text, p_reference text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order record;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  if p_status not in ('approved','rejected','cancelled') then raise exception 'Estado no valido.'; end if;

  select * into v_order from public.aliado_visibility_orders where id = p_order_id for update;
  if not found then raise exception 'Solicitud no encontrada.'; end if;
  if v_order.payment_status <> 'pending' then raise exception 'Esta solicitud ya fue resuelta.'; end if;

  if p_status = 'approved' then
    update public.aliado_visibility_orders
      set payment_status = 'approved',
          payment_reference = nullif(left(btrim(coalesce(p_reference, '')), 120), ''),
          start_date = current_date,
          end_date = current_date + (v_order.days - 1),
          approved_at = now(),
          approved_by = v_uid,
          updated_at = now()
      where id = p_order_id;
  else
    update public.aliado_visibility_orders
      set payment_status = p_status,
          payment_reference = nullif(left(btrim(coalesce(p_reference, '')), 120), ''),
          approved_at = now(),
          approved_by = v_uid,
          updated_at = now()
      where id = p_order_id;
  end if;
end;
$$;
revoke all on function public.admin_set_aliado_visibility_payment(uuid, text, text) from public, anon;
grant execute on function public.admin_set_aliado_visibility_payment(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC admin: cambiar tarifa/limites. El aliado nunca puede llamar a esto (no
-- valida rol de aliado siquiera: exige is_admin()).
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_aliado_visibility_settings(p_daily_rate integer, p_min_days integer, p_max_days integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  if p_daily_rate is null or p_daily_rate <= 0 then raise exception 'La tarifa diaria debe ser mayor a cero.'; end if;
  if p_min_days is null or p_min_days <= 0 then raise exception 'La duracion minima debe ser mayor a cero.'; end if;
  if p_max_days is null or p_max_days < p_min_days then raise exception 'La duracion maxima debe ser mayor o igual a la minima.'; end if;

  update public.aliado_visibility_settings
    set daily_rate = p_daily_rate, min_days = p_min_days, max_days = p_max_days,
        updated_at = now(), updated_by = v_uid
    where id = true;
end;
$$;
revoke all on function public.admin_set_aliado_visibility_settings(integer, integer, integer) from public, anon;
grant execute on function public.admin_set_aliado_visibility_settings(integer, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC publica: aliados vigentes (org aprobada+activa+publicada Y con una
-- solicitud de visibilidad pagada y dentro de fecha). Deja de aparecer solo
-- automaticamente al vencer (sin necesidad de cron): la condicion de fecha
-- se evalua en cada consulta.
-- ---------------------------------------------------------------------------
create or replace function public.list_public_active_allies()
returns table (id uuid, name text, logo_url text, logo_path text, city text, country text, end_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.logo_url, o.logo_path, o.city, o.country, v.end_date
  from public.organization_profiles o
  join lateral (
    select av.end_date from public.aliado_visibility_orders av
    where av.org_id = o.id and av.payment_status = 'approved' and av.end_date >= current_date
    order by av.end_date desc limit 1
  ) v on true
  where o.kind = 'aliado' and o.status = 'published' and o.approval_status = 'approved' and o.is_active
  order by o.name
$$;
revoke all on function public.list_public_active_allies() from public;
grant execute on function public.list_public_active_allies() to authenticated, anon;
