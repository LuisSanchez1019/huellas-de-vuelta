-- Bloque B: RPC del PROVEEDOR para generar y consultar SUS PROPIOS lotes/placas
-- QR. Ninguna de estas funciones permite asignar, activar, suspender, reemplazar
-- ni anular (eso sigue siendo exclusivo de qr_admin_* / admin). El proveedor
-- nunca elige el prefijo: se lee de organization_profiles.qr_prefix, asignado
-- por un admin.

-- ---------------------------------------------------------------------------
-- Crear lote (maximo 20 placas por llamada) + generar las placas, status='available'.
-- ---------------------------------------------------------------------------
create or replace function public.qr_provider_batch_create(
  p_quantity integer,
  p_note text default null
)
returns table (batch_id uuid, quantity integer, prefix text, first_code text, last_code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_prefix text;
  v_org_name text;
  v_ref text;
  v_batch uuid;
  v_start integer;
  v_first text;
  v_last text;
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and role = 'proveedor'
  ) then
    raise exception 'No autorizado.';
  end if;

  -- Cantidad: la UI solo ofrece 1/5/10/20, pero la RPC es la garantia real.
  if p_quantity is null or p_quantity not in (1, 5, 10, 20) then
    raise exception 'La cantidad debe ser 1, 5, 10 o 20.';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'La nota del lote no puede superar 300 caracteres.';
  end if;

  select o.qr_prefix, o.name into v_prefix, v_org_name
  from public.organization_profiles o
  where o.owner_id = v_uid and o.kind = 'proveedor';

  if v_prefix is null then
    raise exception 'Tu cuenta todavia no tiene un prefijo de codigo asignado. Contacta al equipo de Huellas de Vuelta.';
  end if;

  v_ref := coalesce(v_org_name, 'Proveedor') || ' · ' || to_char(now(), 'YYYY-MM-DD HH24:MI');

  -- Mismo mecanismo de contador atomico por prefijo que ya usa qr_batch_create (admin).
  insert into public.qr_code_counters (prefix, next_seq)
  values (v_prefix, 0)
  on conflict (prefix) do nothing;

  select next_seq into v_start from public.qr_code_counters
  where prefix = v_prefix for update;

  if v_start + p_quantity > 999 then
    raise exception 'Tu prefijo % ya no tiene codigos disponibles suficientes. Contacta al equipo de Huellas de Vuelta.', v_prefix;
  end if;

  update public.qr_code_counters
    set next_seq = v_start + p_quantity, updated_at = now()
  where prefix = v_prefix;

  insert into public.qr_batches (reference, quantity, note, created_by)
  values (v_ref, p_quantity, v_note, v_uid)
  returning id into v_batch;

  insert into public.qr_tags (batch_id, public_id, short_code, status)
  select
    v_batch,
    public.gen_pet_public_id(),
    v_prefix || '-' || lpad((v_start + gs + 1)::text, 3, '0'),
    'available'
  from generate_series(0, p_quantity - 1) as gs;

  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id)
  select t.id, t.batch_id, 'generated', v_uid
  from public.qr_tags t where t.batch_id = v_batch;

  select min(t.short_code), max(t.short_code) into v_first, v_last
  from public.qr_tags t where t.batch_id = v_batch;

  batch_id := v_batch;
  quantity := p_quantity;
  prefix := v_prefix;
  first_code := v_first;
  last_code := v_last;
  return next;
end;
$$;

revoke all on function public.qr_provider_batch_create(integer, text) from public, anon;
grant execute on function public.qr_provider_batch_create(integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Listar MIS lotes (con conteos por estado).
-- ---------------------------------------------------------------------------
create or replace function public.qr_provider_list_batches()
returns table (
  id uuid, reference text, quantity integer, note text, created_at timestamptz,
  total bigint, available bigint, assigned bigint, active bigint,
  suspended bigint, replaced bigint, annulled bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and role = 'proveedor'
  ) then
    raise exception 'No autorizado.';
  end if;
  return query
  select b.id, b.reference, b.quantity, b.note, b.created_at,
         count(t.id),
         count(t.id) filter (where t.status = 'available'),
         count(t.id) filter (where t.status = 'assigned'),
         count(t.id) filter (where t.status = 'active'),
         count(t.id) filter (where t.status = 'suspended'),
         count(t.id) filter (where t.status = 'replaced'),
         count(t.id) filter (where t.status = 'annulled')
  from public.qr_batches b
  left join public.qr_tags t on t.batch_id = b.id
  where b.created_by = v_uid
  group by b.id
  order by b.created_at desc;
end;
$$;

revoke all on function public.qr_provider_list_batches() from public, anon;
grant execute on function public.qr_provider_list_batches() to authenticated;

-- ---------------------------------------------------------------------------
-- Listar MIS placas (opcionalmente de un lote propio).
-- ---------------------------------------------------------------------------
create or replace function public.qr_provider_list_tags(
  p_batch_id uuid default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, public_id text, short_code text, status text,
  batch_id uuid, batch_reference text,
  created_at timestamptz, updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and role = 'proveedor'
  ) then
    raise exception 'No autorizado.';
  end if;
  return query
  with base as (
    select t.*, b.reference as b_ref
    from public.qr_tags t
    join public.qr_batches b on b.id = t.batch_id
    where b.created_by = v_uid
      and (p_batch_id is null or t.batch_id = p_batch_id)
      and (p_status is null or t.status = p_status)
  )
  select base.id, base.public_id, base.short_code, base.status,
         base.batch_id, base.b_ref, base.created_at, base.updated_at,
         count(*) over ()
  from base
  order by base.short_code
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.qr_provider_list_tags(uuid, text, integer, integer) from public, anon;
grant execute on function public.qr_provider_list_tags(uuid, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Detalle de UNA de mis placas (0 filas si no es mia: no revela si existe).
-- ---------------------------------------------------------------------------
create or replace function public.qr_provider_tag_detail(p_tag_id uuid)
returns table (
  id uuid, public_id text, short_code text, status text,
  batch_id uuid, batch_reference text, created_at timestamptz, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and role = 'proveedor'
  ) then
    raise exception 'No autorizado.';
  end if;
  return query
  select t.id, t.public_id, t.short_code, t.status, t.batch_id, b.reference, t.created_at, t.updated_at
  from public.qr_tags t
  join public.qr_batches b on b.id = t.batch_id
  where t.id = p_tag_id and b.created_by = v_uid;
end;
$$;

revoke all on function public.qr_provider_tag_detail(uuid) from public, anon;
grant execute on function public.qr_provider_tag_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS adicional (defensa en profundidad, no reemplaza las RPC de arriba):
-- cada proveedor puede leer directamente SOLO sus propias filas. La politica
-- admin existente (is_admin()) no se toca.
-- ---------------------------------------------------------------------------
create policy "qr_batches_owner_read" on public.qr_batches for select to authenticated
using (created_by = (select auth.uid()));

create policy "qr_tags_owner_read" on public.qr_tags for select to authenticated
using (exists (
  select 1 from public.qr_batches b
  where b.id = qr_tags.batch_id and b.created_by = (select auth.uid())
));

create policy "qr_tag_events_owner_read" on public.qr_tag_events for select to authenticated
using (exists (
  select 1 from public.qr_batches b
  where b.id = qr_tag_events.batch_id and b.created_by = (select auth.uid())
));
