-- Fix: el indice unico parcial "una placa viva por mascota" saltaba porque se
-- activaba la placa NUEVA antes de marcar la ANTIGUA como 'replaced'. Se invierte
-- el orden: primero se libera la antigua, luego se activa la nueva.
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

  -- 1) liberar la placa antigua (deja de ser "viva" para la mascota)
  update public.qr_tags
     set status = 'replaced', replaced_by_tag_id = p_new_tag_id
   where id = p_old_tag_id;

  -- 2) activar la nueva con la misma mascota
  update public.qr_tags
     set status = 'active', owner_pet_id = v_owner_pet, org_pet_id = v_org_pet, assigned_at = now()
   where id = p_new_tag_id;

  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, org_pet_id, reason)
  values
    (p_old_tag_id, v_old_batch, 'replaced', v_uid, v_owner_pet, v_org_pet, v_reason),
    (p_new_tag_id, v_new_batch, 'assigned', v_uid, v_owner_pet, v_org_pet, v_reason),
    (p_new_tag_id, v_new_batch, 'activated', v_uid, v_owner_pet, v_org_pet, v_reason);
end;
$$;

revoke all on function public.qr_admin_replace(uuid, uuid, text) from public, anon;
grant execute on function public.qr_admin_replace(uuid, uuid, text) to authenticated;
