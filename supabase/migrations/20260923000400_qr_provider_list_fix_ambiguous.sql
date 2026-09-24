-- Fix: mismo problema de ambiguedad de columna que qr_provider_batch_create
-- (ya corregido). Aqui la columna de retorno "id" colisiona con profiles.id
-- dentro de la comprobacion de autorizacion. Se califica profiles.id con
-- alias explicito en las 3 funciones afectadas.

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
    select 1 from public.profiles p where p.id = v_uid and p.role = 'proveedor'
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
    select 1 from public.profiles p where p.id = v_uid and p.role = 'proveedor'
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
    select 1 from public.profiles p where p.id = v_uid and p.role = 'proveedor'
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
