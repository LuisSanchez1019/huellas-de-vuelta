-- Huellas de Vuelta: RPC de administracion de placas QR.
-- TODAS exigen is_admin(). SECURITY DEFINER + search_path=''. El cliente nunca
-- escribe directamente en qr_batches / qr_tags / qr_tag_events.

-- ---------------------------------------------------------------------------
-- Crear lote + generar N placas.
-- ---------------------------------------------------------------------------
create or replace function public.qr_batch_create(
  p_reference text,
  p_quantity integer,
  p_note text default null
)
returns table (batch_id uuid, quantity integer, first_code text, last_code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ref text := btrim(coalesce(p_reference, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_batch uuid;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if char_length(v_ref) < 2 or char_length(v_ref) > 120 then
    raise exception 'La referencia del lote debe tener entre 2 y 120 caracteres.';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 5000 then
    raise exception 'La cantidad debe estar entre 1 y 5000.';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'La nota del lote no puede superar 300 caracteres.';
  end if;

  insert into public.qr_batches (reference, quantity, note, created_by)
  values (v_ref, p_quantity, v_note, v_uid)
  returning id into v_batch;

  -- Generacion en bloque. public_id = token aleatorio de 12 chars (mismo
  -- generador que las mascotas); short_code = HV-###### secuencial global.
  with created as (
    insert into public.qr_tags (batch_id, public_id, short_code, status)
    select
      v_batch,
      public.gen_pet_public_id(),
      'HV-' || lpad(nextval('public.qr_short_code_seq')::text, 6, '0'),
      'available'
    from generate_series(1, p_quantity)
    returning id, batch_id, short_code
  )
  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id)
  select id, batch_id, 'generated', v_uid from created;

  select min(t.short_code), max(t.short_code)
    into first_code, last_code
  from public.qr_tags t where t.batch_id = v_batch;

  batch_id := v_batch;
  quantity := p_quantity;
  return next;
end;
$$;

revoke all on function public.qr_batch_create(text, integer, text) from public, anon;
grant execute on function public.qr_batch_create(text, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Listar lotes con conteos por estado.
-- ---------------------------------------------------------------------------
create or replace function public.qr_admin_list_batches()
returns table (
  id uuid, reference text, quantity integer, note text, is_system boolean,
  created_at timestamptz,
  total bigint, available bigint, assigned bigint, active bigint,
  suspended bigint, replaced bigint, annulled bigint
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
  select b.id, b.reference, b.quantity, b.note, b.is_system, b.created_at,
         count(t.id),
         count(t.id) filter (where t.status = 'available'),
         count(t.id) filter (where t.status = 'assigned'),
         count(t.id) filter (where t.status = 'active'),
         count(t.id) filter (where t.status = 'suspended'),
         count(t.id) filter (where t.status = 'replaced'),
         count(t.id) filter (where t.status = 'annulled')
  from public.qr_batches b
  left join public.qr_tags t on t.batch_id = b.id
  group by b.id
  order by b.created_at desc;
end;
$$;

revoke all on function public.qr_admin_list_batches() from public, anon;
grant execute on function public.qr_admin_list_batches() to authenticated;

-- ---------------------------------------------------------------------------
-- Listar / buscar placas (paginado).
-- ---------------------------------------------------------------------------
create or replace function public.qr_admin_list_tags(
  p_batch_id uuid default null,
  p_status text default null,
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, public_id text, short_code text, status text,
  batch_id uuid, batch_reference text,
  pet_kind text, pet_id uuid, pet_name text,
  assigned_at timestamptz, updated_at timestamptz, created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  return query
  with base as (
    select t.*,
           b.reference as b_ref,
           coalesce(op.name, gp.name) as p_name,
           case when t.owner_pet_id is not null then 'owner'
                when t.org_pet_id is not null then 'org' else null end as p_kind,
           coalesce(t.owner_pet_id, t.org_pet_id) as p_id
    from public.qr_tags t
    join public.qr_batches b on b.id = t.batch_id
    left join public.pets op on op.id = t.owner_pet_id
    left join public.organization_pets gp on gp.id = t.org_pet_id
    where (p_batch_id is null or t.batch_id = p_batch_id)
      and (p_status is null or t.status = p_status)
      and (
        v_q is null
        or t.short_code ilike '%' || v_q || '%'
        or t.public_id ilike '%' || v_q || '%'
        or coalesce(op.name, gp.name, '') ilike '%' || v_q || '%'
      )
  )
  select base.id, base.public_id, base.short_code, base.status,
         base.batch_id, base.b_ref,
         base.p_kind, base.p_id, base.p_name,
         base.assigned_at, base.updated_at, base.created_at,
         count(*) over ()
  from base
  order by base.short_code
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.qr_admin_list_tags(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.qr_admin_list_tags(uuid, text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Detalle de una placa.
-- ---------------------------------------------------------------------------
create or replace function public.qr_admin_tag_detail(p_tag_id uuid)
returns table (
  id uuid, public_id text, short_code text, status text, notes text,
  batch_id uuid, batch_reference text,
  pet_kind text, pet_id uuid, pet_name text, pet_extra text, pet_owner_label text,
  replaced_by_tag_id uuid, replaced_by_code text,
  assigned_at timestamptz, created_at timestamptz, updated_at timestamptz
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
  select t.id, t.public_id, t.short_code, t.status, t.notes,
         t.batch_id, b.reference,
         case when t.owner_pet_id is not null then 'owner'
              when t.org_pet_id is not null then 'org' else null end,
         coalesce(t.owner_pet_id, t.org_pet_id),
         coalesce(op.name, gp.name),
         case when op.id is not null
                then op.species::text
              when gp.id is not null
                then gp.species::text || coalesce(' - ' || gp.breed, '')
              else null end,
         case when op.id is not null then ownr.email::text
              when gp.id is not null then orgp.name
              else null end,
         t.replaced_by_tag_id, rb.short_code,
         t.assigned_at, t.created_at, t.updated_at
  from public.qr_tags t
  join public.qr_batches b on b.id = t.batch_id
  left join public.pets op on op.id = t.owner_pet_id
  left join auth.users ownr on ownr.id = op.owner_id
  left join public.organization_pets gp on gp.id = t.org_pet_id
  left join public.organization_profiles orgp on orgp.owner_id = gp.org_id
  left join public.qr_tags rb on rb.id = t.replaced_by_tag_id
  where t.id = p_tag_id;
end;
$$;

revoke all on function public.qr_admin_tag_detail(uuid) from public, anon;
grant execute on function public.qr_admin_tag_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Historial (eventos) de una placa.
-- ---------------------------------------------------------------------------
create or replace function public.qr_admin_tag_events(p_tag_id uuid)
returns table (
  id uuid, event text, reason text, actor_email text,
  owner_pet_id uuid, org_pet_id uuid, created_at timestamptz
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
  select e.id, e.event, e.reason, u.email::text,
         e.owner_pet_id, e.org_pet_id, e.created_at
  from public.qr_tag_events e
  left join auth.users u on u.id = e.actor_id
  where e.tag_id = p_tag_id
  order by e.created_at desc, e.id desc;
end;
$$;

revoke all on function public.qr_admin_tag_events(uuid) from public, anon;
grant execute on function public.qr_admin_tag_events(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Buscar mascotas (pets + organization_pets) para asignar. Solo admin, via
-- funcion controlada: NO se abre la RLS de pets.
-- ---------------------------------------------------------------------------
create or replace function public.qr_admin_search_pets(
  p_query text,
  p_limit integer default 20
)
returns table (
  pet_kind text, pet_id uuid, name text, extra text, owner_label text,
  has_live_tag boolean, live_tag_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if v_q is null or char_length(v_q) < 2 then
    return;
  end if;
  return query
  select * from (
    select 'owner'::text, p.id, p.name,
           p.species::text || coalesce(' - ' || p.breed, ''),
           u.email::text,
           lt.id is not null,
           lt.short_code
    from public.pets p
    left join auth.users u on u.id = p.owner_id
    left join public.qr_tags lt
      on lt.owner_pet_id = p.id and lt.status in ('assigned','active','suspended')
    where not p.is_archived
      and (p.name ilike '%' || v_q || '%' or p.public_id ilike '%' || v_q || '%')
    union all
    select 'org'::text, op.id, op.name,
           op.species::text || coalesce(' - ' || op.breed, ''),
           o.name,
           lt.id is not null,
           lt.short_code
    from public.organization_pets op
    left join public.organization_profiles o on o.owner_id = op.org_id
    left join public.qr_tags lt
      on lt.org_pet_id = op.id and lt.status in ('assigned','active','suspended')
    where op.name ilike '%' || v_q || '%' or op.public_id ilike '%' || v_q || '%'
  ) s(pet_kind, pet_id, name, extra, owner_label, has_live_tag, live_tag_code)
  order by s.name
  limit v_limit;
end;
$$;

revoke all on function public.qr_admin_search_pets(text, integer) from public, anon;
grant execute on function public.qr_admin_search_pets(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Asignar una placa disponible a una mascota.
-- ---------------------------------------------------------------------------
create or replace function public.qr_admin_assign(
  p_tag_id uuid,
  p_pet_kind text,
  p_pet_id uuid,
  p_activate boolean default true,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_status text;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
  v_new_status text := case when coalesce(p_activate, true) then 'active' else 'assigned' end;
  v_owner_pet uuid := null;
  v_org_pet uuid := null;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if p_pet_kind not in ('owner','org') then
    raise exception 'Tipo de mascota no valido.';
  end if;

  select status into v_status from public.qr_tags where id = p_tag_id for update;
  if not found then
    raise exception 'La placa no existe.';
  end if;
  if v_status <> 'available' then
    raise exception 'La placa no esta disponible (estado actual: %).', v_status;
  end if;

  if p_pet_kind = 'owner' then
    if not exists (select 1 from public.pets where id = p_pet_id and not is_archived) then
      raise exception 'La mascota no existe.';
    end if;
    v_owner_pet := p_pet_id;
  else
    if not exists (select 1 from public.organization_pets where id = p_pet_id) then
      raise exception 'La mascota no existe.';
    end if;
    v_org_pet := p_pet_id;
  end if;

  if exists (
    select 1 from public.qr_tags
    where status in ('assigned','active','suspended')
      and (owner_pet_id = p_pet_id or org_pet_id = p_pet_id)
  ) then
    raise exception 'Esta mascota ya tiene una placa vinculada. Desasignala o reemplazala primero.';
  end if;

  update public.qr_tags
     set owner_pet_id = v_owner_pet,
         org_pet_id = v_org_pet,
         status = v_new_status,
         assigned_at = now()
   where id = p_tag_id;

  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id, reason)
  select p_tag_id, batch_id, 'assigned', v_uid, v_owner_pet, v_org_pet, v_reason
  from public.qr_tags where id = p_tag_id;

  if v_new_status = 'active' then
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id)
    select p_tag_id, batch_id, 'activated', v_uid, v_owner_pet, v_org_pet
    from public.qr_tags where id = p_tag_id;
  end if;
end;
$$;

revoke all on function public.qr_admin_assign(uuid, text, uuid, boolean, text) from public, anon;
grant execute on function public.qr_admin_assign(uuid, text, uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Transiciones simples de estado.
-- ---------------------------------------------------------------------------
create or replace function public.qr_admin_set_state(
  p_tag_id uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_status text;
  v_owner_pet uuid;
  v_org_pet uuid;
  v_batch uuid;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if p_action not in ('activate','suspend','resume','unassign','annul') then
    raise exception 'Accion no valida.';
  end if;

  select status, owner_pet_id, org_pet_id, batch_id
    into v_status, v_owner_pet, v_org_pet, v_batch
  from public.qr_tags where id = p_tag_id for update;
  if not found then
    raise exception 'La placa no existe.';
  end if;

  if p_action = 'activate' then
    if v_status <> 'assigned' then
      raise exception 'Solo se puede activar una placa en estado "asignada".';
    end if;
    update public.qr_tags set status = 'active' where id = p_tag_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id, reason)
    values (p_tag_id, v_batch, 'activated', v_uid, v_owner_pet, v_org_pet, v_reason);

  elsif p_action = 'suspend' then
    if v_status <> 'active' then
      raise exception 'Solo se puede suspender una placa activa.';
    end if;
    update public.qr_tags set status = 'suspended' where id = p_tag_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id, reason)
    values (p_tag_id, v_batch, 'suspended', v_uid, v_owner_pet, v_org_pet, v_reason);

  elsif p_action = 'resume' then
    if v_status <> 'suspended' then
      raise exception 'Solo se puede reanudar una placa suspendida.';
    end if;
    update public.qr_tags set status = 'active' where id = p_tag_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id, reason)
    values (p_tag_id, v_batch, 'resumed', v_uid, v_owner_pet, v_org_pet, v_reason);

  elsif p_action = 'unassign' then
    if v_status not in ('assigned','active','suspended') then
      raise exception 'La placa no esta asignada.';
    end if;
    update public.qr_tags
       set status = 'available', owner_pet_id = null, org_pet_id = null, assigned_at = null
     where id = p_tag_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id, reason)
    values (p_tag_id, v_batch, 'unassigned', v_uid, v_owner_pet, v_org_pet, v_reason);

  else -- annul
    if v_status = 'annulled' then
      raise exception 'La placa ya esta anulada.';
    end if;
    update public.qr_tags set status = 'annulled' where id = p_tag_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id, reason)
    values (p_tag_id, v_batch, 'annulled', v_uid, v_owner_pet, v_org_pet, v_reason);
  end if;
end;
$$;

revoke all on function public.qr_admin_set_state(uuid, text, text) from public, anon;
grant execute on function public.qr_admin_set_state(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reemplazar una placa por otra disponible, conservando la mascota y el perfil.
-- ---------------------------------------------------------------------------
create or replace function public.qr_admin_replace(
  p_old_tag_id uuid,
  p_new_tag_id uuid,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_old_status text; v_new_status text;
  v_owner_pet uuid; v_org_pet uuid;
  v_old_batch uuid; v_new_batch uuid;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if p_old_tag_id = p_new_tag_id then
    raise exception 'La placa nueva debe ser distinta.';
  end if;

  select status, owner_pet_id, org_pet_id, batch_id
    into v_old_status, v_owner_pet, v_org_pet, v_old_batch
  from public.qr_tags where id = p_old_tag_id for update;
  if not found then
    raise exception 'La placa a reemplazar no existe.';
  end if;
  if v_old_status not in ('assigned','active','suspended') then
    raise exception 'Solo se puede reemplazar una placa asignada.';
  end if;

  select status, batch_id into v_new_status, v_new_batch
  from public.qr_tags where id = p_new_tag_id for update;
  if not found then
    raise exception 'La placa nueva no existe.';
  end if;
  if v_new_status <> 'available' then
    raise exception 'La placa nueva no esta disponible.';
  end if;

  update public.qr_tags
     set status = 'active', owner_pet_id = v_owner_pet, org_pet_id = v_org_pet, assigned_at = now()
   where id = p_new_tag_id;

  update public.qr_tags
     set status = 'replaced', replaced_by_tag_id = p_new_tag_id
   where id = p_old_tag_id;

  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id, reason)
  values
    (p_old_tag_id, v_old_batch, 'replaced', v_uid, v_owner_pet, v_org_pet, v_reason),
    (p_new_tag_id, v_new_batch, 'assigned', v_uid, v_owner_pet, v_org_pet, v_reason),
    (p_new_tag_id, v_new_batch, 'activated', v_uid, v_owner_pet, v_org_pet, v_reason);
end;
$$;

revoke all on function public.qr_admin_replace(uuid, uuid, text) from public, anon;
grant execute on function public.qr_admin_replace(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Datos para el documento imprimible (una placa por fila).
-- ---------------------------------------------------------------------------
create or replace function public.qr_admin_export_batch(
  p_batch_id uuid,
  p_from_code text default null,
  p_to_code text default null
)
returns table (short_code text, public_id text, status text)
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
  select t.short_code, t.public_id, t.status
  from public.qr_tags t
  where t.batch_id = p_batch_id
    and (p_from_code is null or t.short_code >= p_from_code)
    and (p_to_code is null or t.short_code <= p_to_code)
  order by t.short_code;
end;
$$;

revoke all on function public.qr_admin_export_batch(uuid, text, text) from public, anon;
grant execute on function public.qr_admin_export_batch(uuid, text, text) to authenticated;
