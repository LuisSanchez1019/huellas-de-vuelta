-- Huellas de Vuelta: RPC de "Informacion medica". SECURITY DEFINER,
-- search_path=''. Validan longitudes y limpian caracteres de control en
-- servidor (no se confia en el maxlength del HTML).
--
-- Permisos:
--   * mascota de usuario  -> solo el propietario escribe (source = 'owner').
--   * mascota de organizacion -> solo la organizacion dueña escribe
--     (source = 'vet' o 'fundacion' segun el rol). Sin permisos globales.
--   * admin: lectura. No se le exige para escribir.
--   * Una fuente no puede editar/borrar items de otra fuente (salvo admin).

create or replace function public._pet_medical_ctx(
  p_pet_kind text,
  p_pet_id uuid,
  out can_write boolean,
  out can_read boolean,
  out source text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pet_owner uuid;
  v_role text;
begin
  can_write := false; can_read := false; source := null;
  if p_pet_kind not in ('owner','org') then
    raise exception 'Tipo de mascota no valido.';
  end if;

  if p_pet_kind = 'owner' then
    select owner_id into v_pet_owner from public.pets where id = p_pet_id and not is_archived;
    if not found then raise exception 'La mascota no existe.'; end if;
    source := 'owner';
    can_write := (v_pet_owner = v_uid);
  else
    select op.org_id into v_pet_owner from public.organization_pets op where op.id = p_pet_id;
    if not found then raise exception 'La mascota no existe.'; end if;
    select p.role::text into v_role from public.profiles p where p.id = v_uid;
    source := case v_role when 'fundacion' then 'fundacion' else 'vet' end;
    can_write := (v_pet_owner = v_uid and v_role in ('veterinaria','fundacion'));
  end if;

  can_read := can_write or public.is_admin();
end;
$$;

revoke all on function public._pet_medical_ctx(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leer el resumen medico.
-- ---------------------------------------------------------------------------
create or replace function public.pet_medical_get(p_pet_kind text, p_pet_id uuid)
returns table (
  summary_id uuid,
  has_condition boolean, has_allergy boolean, has_medication boolean, has_urgent boolean,
  notes text, public_alert_enabled boolean, public_urgent_enabled boolean,
  updated_at timestamptz, caller_source text, can_write boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx record;
begin
  select * into v_ctx from public._pet_medical_ctx(p_pet_kind, p_pet_id);
  if not v_ctx.can_read then
    raise exception 'No autorizado.';
  end if;

  return query
  select s.id,
         coalesce(s.has_condition, false), coalesce(s.has_allergy, false),
         coalesce(s.has_medication, false), coalesce(s.has_urgent, false),
         s.notes, coalesce(s.public_alert_enabled, false), coalesce(s.public_urgent_enabled, false),
         s.updated_at, v_ctx.source, v_ctx.can_write
  from (select 1) dummy
  left join public.pet_medical_summary s
    on (p_pet_kind = 'owner' and s.owner_pet_id = p_pet_id)
    or (p_pet_kind = 'org' and s.org_pet_id = p_pet_id);
end;
$$;

revoke all on function public.pet_medical_get(text, uuid) from public, anon;
grant execute on function public.pet_medical_get(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Listar items.
-- ---------------------------------------------------------------------------
create or replace function public.pet_medical_items_list(p_pet_kind text, p_pet_id uuid)
returns table (
  id uuid, kind text, label text, detail text, source text,
  can_edit boolean, created_at timestamptz, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx record;
begin
  select * into v_ctx from public._pet_medical_ctx(p_pet_kind, p_pet_id);
  if not v_ctx.can_read then
    raise exception 'No autorizado.';
  end if;

  return query
  select i.id, i.kind, i.label, i.detail, i.source,
         (public.is_admin() or (v_ctx.can_write and i.source = v_ctx.source)),
         i.created_at, i.updated_at
  from public.pet_medical_items i
  join public.pet_medical_summary s on s.id = i.summary_id
  where (p_pet_kind = 'owner' and s.owner_pet_id = p_pet_id)
     or (p_pet_kind = 'org' and s.org_pet_id = p_pet_id)
  order by i.kind, i.created_at;
end;
$$;

revoke all on function public.pet_medical_items_list(text, uuid) from public, anon;
grant execute on function public.pet_medical_items_list(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Helper: obtener/crear la fila de resumen.
-- ---------------------------------------------------------------------------
create or replace function public._pet_medical_summary_id(p_pet_kind text, p_pet_id uuid, p_uid uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select s.id into v_id from public.pet_medical_summary s
  where (p_pet_kind = 'owner' and s.owner_pet_id = p_pet_id)
     or (p_pet_kind = 'org' and s.org_pet_id = p_pet_id);
  if v_id is not null then
    return v_id;
  end if;
  insert into public.pet_medical_summary (owner_pet_id, org_pet_id, updated_by)
  values (
    case when p_pet_kind = 'owner' then p_pet_id end,
    case when p_pet_kind = 'org' then p_pet_id end,
    p_uid
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public._pet_medical_summary_id(text, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guardar el resumen (flags Si/No + observaciones + visibilidad publica).
-- ---------------------------------------------------------------------------
create or replace function public.pet_medical_save_summary(
  p_pet_kind text,
  p_pet_id uuid,
  p_has_condition boolean,
  p_has_allergy boolean,
  p_has_medication boolean,
  p_has_urgent boolean,
  p_notes text,
  p_public_alert boolean,
  p_public_urgent boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ctx record;
  v_summary uuid;
  v_notes text;
begin
  select * into v_ctx from public._pet_medical_ctx(p_pet_kind, p_pet_id);
  if not v_ctx.can_write then
    raise exception 'No autorizado.';
  end if;

  v_notes := regexp_replace(coalesce(p_notes, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
  v_notes := btrim(regexp_replace(v_notes, '[ \t]+', ' ', 'g'));
  if char_length(v_notes) > 500 then
    raise exception 'Las observaciones no pueden superar 500 caracteres.';
  end if;
  v_notes := nullif(v_notes, '');

  v_summary := public._pet_medical_summary_id(p_pet_kind, p_pet_id, v_uid);

  update public.pet_medical_summary
     set has_condition = coalesce(p_has_condition, false),
         has_allergy = coalesce(p_has_allergy, false),
         has_medication = coalesce(p_has_medication, false),
         has_urgent = coalesce(p_has_urgent, false),
         notes = v_notes,
         public_alert_enabled = coalesce(p_public_alert, false),
         public_urgent_enabled = coalesce(p_public_urgent, false) and coalesce(p_has_urgent, false),
         updated_by = v_uid
   where id = v_summary;

  return v_summary;
end;
$$;

revoke all on function public.pet_medical_save_summary(text, uuid, boolean, boolean, boolean, boolean, text, boolean, boolean) from public, anon;
grant execute on function public.pet_medical_save_summary(text, uuid, boolean, boolean, boolean, boolean, text, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Añadir un item (condicion / alergia / medicamento / urgente).
-- ---------------------------------------------------------------------------
create or replace function public.pet_medical_item_add(
  p_pet_kind text,
  p_pet_id uuid,
  p_kind text,
  p_label text,
  p_detail text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ctx record;
  v_summary uuid;
  v_label text;
  v_detail text;
  v_label_max integer;
  v_detail_max integer;
  v_count integer;
  v_id uuid;
begin
  select * into v_ctx from public._pet_medical_ctx(p_pet_kind, p_pet_id);
  if not v_ctx.can_write then
    raise exception 'No autorizado.';
  end if;
  if p_kind not in ('condition','allergy','medication','urgent') then
    raise exception 'Tipo de dato medico no valido.';
  end if;

  v_label_max := case p_kind when 'medication' then 100 else 150 end;
  v_detail_max := case p_kind when 'medication' then 200 when 'urgent' then 250 else 0 end;

  v_label := regexp_replace(coalesce(p_label, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
  v_label := btrim(regexp_replace(v_label, '[ \t]+', ' ', 'g'));
  if char_length(v_label) < 1 then
    raise exception 'El texto es obligatorio.';
  end if;
  if char_length(v_label) > v_label_max then
    raise exception 'Ese campo no puede superar % caracteres.', v_label_max;
  end if;

  v_detail := regexp_replace(coalesce(p_detail, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
  v_detail := btrim(regexp_replace(v_detail, '[ \t]+', ' ', 'g'));
  if v_detail_max = 0 then
    v_detail := null;
  elsif char_length(v_detail) > v_detail_max then
    raise exception 'Ese campo no puede superar % caracteres.', v_detail_max;
  else
    v_detail := nullif(v_detail, '');
  end if;

  v_summary := public._pet_medical_summary_id(p_pet_kind, p_pet_id, v_uid);

  select count(*) into v_count from public.pet_medical_items
  where summary_id = v_summary and kind = p_kind;
  if v_count >= 20 then
    raise exception 'Alcanzaste el maximo de registros para esta categoria.';
  end if;

  insert into public.pet_medical_items (summary_id, kind, label, detail, source, author_id)
  values (v_summary, p_kind, v_label, v_detail, v_ctx.source, v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.pet_medical_item_add(text, uuid, text, text, text) from public, anon;
grant execute on function public.pet_medical_item_add(text, uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Editar un item.
-- ---------------------------------------------------------------------------
create or replace function public.pet_medical_item_update(
  p_item_id uuid,
  p_label text,
  p_detail text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ctx record;
  v_kind text;
  v_src text;
  v_owner_pet uuid;
  v_org_pet uuid;
  v_pet_kind text;
  v_pet_id uuid;
  v_label text;
  v_detail text;
  v_label_max integer;
  v_detail_max integer;
begin
  select i.kind, i.source, s.owner_pet_id, s.org_pet_id
    into v_kind, v_src, v_owner_pet, v_org_pet
  from public.pet_medical_items i
  join public.pet_medical_summary s on s.id = i.summary_id
  where i.id = p_item_id;
  if not found then
    raise exception 'El registro no existe.';
  end if;

  v_pet_kind := case when v_owner_pet is not null then 'owner' else 'org' end;
  v_pet_id := coalesce(v_owner_pet, v_org_pet);
  select * into v_ctx from public._pet_medical_ctx(v_pet_kind, v_pet_id);
  if not (public.is_admin() or (v_ctx.can_write and v_src = v_ctx.source)) then
    raise exception 'No puedes editar informacion registrada por otra fuente.';
  end if;

  v_label_max := case v_kind when 'medication' then 100 else 150 end;
  v_detail_max := case v_kind when 'medication' then 200 when 'urgent' then 250 else 0 end;

  v_label := btrim(regexp_replace(
    regexp_replace(coalesce(p_label, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'),
    '[ \t]+', ' ', 'g'));
  if char_length(v_label) < 1 then
    raise exception 'El texto es obligatorio.';
  end if;
  if char_length(v_label) > v_label_max then
    raise exception 'Ese campo no puede superar % caracteres.', v_label_max;
  end if;

  v_detail := btrim(regexp_replace(
    regexp_replace(coalesce(p_detail, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'),
    '[ \t]+', ' ', 'g'));
  if v_detail_max = 0 then
    v_detail := null;
  elsif char_length(v_detail) > v_detail_max then
    raise exception 'Ese campo no puede superar % caracteres.', v_detail_max;
  else
    v_detail := nullif(v_detail, '');
  end if;

  update public.pet_medical_items
     set label = v_label, detail = v_detail
   where id = p_item_id;
end;
$$;

revoke all on function public.pet_medical_item_update(uuid, text, text) from public, anon;
grant execute on function public.pet_medical_item_update(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Borrar un item.
-- ---------------------------------------------------------------------------
create or replace function public.pet_medical_item_delete(p_item_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_src text;
  v_owner_pet uuid;
  v_org_pet uuid;
  v_pet_kind text;
  v_pet_id uuid;
begin
  select i.source, s.owner_pet_id, s.org_pet_id
    into v_src, v_owner_pet, v_org_pet
  from public.pet_medical_items i
  join public.pet_medical_summary s on s.id = i.summary_id
  where i.id = p_item_id;
  if not found then
    raise exception 'El registro no existe.';
  end if;

  v_pet_kind := case when v_owner_pet is not null then 'owner' else 'org' end;
  v_pet_id := coalesce(v_owner_pet, v_org_pet);
  select * into v_ctx from public._pet_medical_ctx(v_pet_kind, v_pet_id);
  if not (public.is_admin() or (v_ctx.can_write and v_src = v_ctx.source)) then
    raise exception 'No puedes borrar informacion registrada por otra fuente.';
  end if;

  delete from public.pet_medical_items where id = p_item_id;
end;
$$;

revoke all on function public.pet_medical_item_delete(uuid) from public, anon;
grant execute on function public.pet_medical_item_delete(uuid) to authenticated;
