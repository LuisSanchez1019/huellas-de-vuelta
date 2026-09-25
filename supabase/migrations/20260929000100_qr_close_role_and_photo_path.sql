-- Mini cierre del modulo QR.
-- 1. El claim y las acciones del propietario son SOLO de cuentas `usuario` (aliado, fundacion, veterinaria y
--    proveedor no reclaman ni activan placas).
-- 2. La ruta de la foto de una mascota debe vivir en la carpeta de su propietario. `is_public_pet_photo` decide
--    por la RUTA: sin esta restriccion, un dueno podia apuntar el `photo_path` de su mascota (en estado
--    perdida/adopcion) a la ruta privada de OTRA persona y volverla firmable por cualquiera.

create or replace function public.qr_claim_tag(p_public_id text, p_pet_id uuid)
returns table(short_code text, tag_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_pet_archived boolean;
  v_tag_id uuid;
  v_current_status text;
  v_short_code text;
  v_batch_id uuid;
  v_old_id uuid;
  v_old_status text;
  v_old_batch uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select pr.role::text into v_role from public.profiles pr where pr.id = v_uid;
  if v_role is distinct from 'usuario' then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;

  select p.is_archived into v_pet_archived
  from public.pets p
  where p.id = p_pet_id and p.owner_id = v_uid;
  if not found then
    raise exception 'PET_NOT_FOUND';
  end if;
  if v_pet_archived then
    raise exception 'PET_ARCHIVED';
  end if;

  select t.id, t.status, t.short_code, t.batch_id
    into v_tag_id, v_current_status, v_short_code, v_batch_id
  from public.qr_tags t
  where t.public_id = p_public_id
  for update;
  if not found then
    raise exception 'TAG_NOT_FOUND';
  end if;

  if v_current_status <> 'available' then
    case v_current_status
      when 'assigned'  then raise exception 'TAG_ALREADY_ASSIGNED';
      when 'active'    then raise exception 'TAG_ALREADY_ACTIVE';
      when 'suspended' then raise exception 'TAG_SUSPENDED';
      when 'replaced'  then raise exception 'TAG_REPLACED';
      when 'annulled'  then raise exception 'TAG_ANNULLED';
      else raise exception 'TAG_NOT_AVAILABLE';
    end case;
  end if;

  select t.id, t.status, t.batch_id into v_old_id, v_old_status, v_old_batch
  from public.qr_tags t
  where t.owner_pet_id = p_pet_id and t.status in ('assigned', 'active', 'suspended')
  for update;
  if found then
    if v_old_status <> 'suspended' then
      raise exception 'PET_ALREADY_HAS_TAG';
    end if;
    update public.qr_tags set status = 'replaced', replaced_by_tag_id = v_tag_id where id = v_old_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, reason)
    values (v_old_id, v_old_batch, 'replaced', v_uid, p_pet_id, 'Reemplazada por el propietario con una placa nueva');
  end if;

  update public.qr_tags
    set owner_pet_id = p_pet_id, status = 'active', assigned_at = now()
  where id = v_tag_id;

  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id)
  values (v_tag_id, v_batch_id, 'assigned', v_uid, p_pet_id);
  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id)
  values (v_tag_id, v_batch_id, 'activated', v_uid, p_pet_id);

  short_code := v_short_code;
  tag_status := 'active';
  return next;
exception
  when unique_violation then
    raise exception 'PET_ALREADY_HAS_TAG';
end;
$$;
revoke all on function public.qr_claim_tag(text, uuid) from public, anon;
grant execute on function public.qr_claim_tag(text, uuid) to authenticated;

create or replace function public.qr_owner_set_pet_tag_state(p_pet_id uuid, p_action text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_tag_id uuid;
  v_status text;
  v_batch uuid;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
  v_last_actor uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select pr.role::text into v_role from public.profiles pr where pr.id = v_uid;
  if v_role is distinct from 'usuario' then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;
  if p_action not in ('suspend', 'resume') then
    raise exception 'INVALID_ACTION';
  end if;
  if not exists (select 1 from public.pets p where p.id = p_pet_id and p.owner_id = v_uid) then
    raise exception 'PET_NOT_FOUND';
  end if;

  select t.id, t.status, t.batch_id into v_tag_id, v_status, v_batch
  from public.qr_tags t
  where t.owner_pet_id = p_pet_id and t.status in ('active', 'suspended')
  for update;
  if not found then
    raise exception 'TAG_NOT_FOUND';
  end if;

  if p_action = 'suspend' then
    if v_status <> 'active' then
      raise exception 'TAG_NOT_ACTIVE';
    end if;
    update public.qr_tags set status = 'suspended' where id = v_tag_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, reason)
    values (v_tag_id, v_batch, 'suspended', v_uid, p_pet_id, coalesce(v_reason, 'Suspendida por el propietario'));
  else
    if v_status <> 'suspended' then
      raise exception 'TAG_NOT_SUSPENDED';
    end if;
    select e.actor_id into v_last_actor
    from public.qr_tag_events e
    where e.tag_id = v_tag_id and e.event = 'suspended'
    order by e.created_at desc, e.id desc
    limit 1;
    if v_last_actor is distinct from v_uid then
      raise exception 'TAG_SUSPENDED_BY_ADMIN';
    end if;
    update public.qr_tags set status = 'active' where id = v_tag_id;
    insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, reason)
    values (v_tag_id, v_batch, 'resumed', v_uid, p_pet_id, coalesce(v_reason, 'Reactivada por el propietario'));
  end if;
end;
$$;
revoke all on function public.qr_owner_set_pet_tag_state(uuid, text, text) from public, anon;
grant execute on function public.qr_owner_set_pet_tag_state(uuid, text, text) to authenticated;

-- La foto vive en la carpeta de su propietario (pets: owner_id; organization_pets: org_id).
create or replace function public.guard_photo_path_folder()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if new.photo_path is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.photo_path is not distinct from old.photo_path then
    return new;
  end if;
  v_owner := (to_jsonb(new) ->> case tg_table_name when 'pets' then 'owner_id' else 'org_id' end)::uuid;
  if split_part(new.photo_path, '/', 1) is distinct from v_owner::text then
    raise exception 'PHOTO_PATH_FOREIGN';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_photo_path_folder() from public, anon, authenticated;

drop trigger if exists pets_guard_photo_path on public.pets;
create trigger pets_guard_photo_path
  before insert or update of photo_path on public.pets
  for each row execute function public.guard_photo_path_folder();

drop trigger if exists organization_pets_guard_photo_path on public.organization_pets;
create trigger organization_pets_guard_photo_path
  before insert or update of photo_path on public.organization_pets
  for each row execute function public.guard_photo_path_folder();
