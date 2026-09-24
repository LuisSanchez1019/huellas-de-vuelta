-- Bloque C: reclamo de una placa QR disponible por su dueño real. Única
-- operación atómica: valida sesión real, valida que la mascota sea del
-- usuario (nunca confía en el frontend), bloquea la placa con FOR UPDATE,
-- exige status='available', asigna y activa, y registra ambos eventos.
-- El indice unico parcial qr_tags_one_live_per_owner_pet (ya existente) es la
-- segunda capa de seguridad ante una carrera real (se traduce a un error
-- controlado en el bloque EXCEPTION).
create or replace function public.qr_claim_tag(
  p_public_id text,
  p_pet_id uuid
)
returns table (short_code text, tag_status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pet_archived boolean;
  v_tag_id uuid;
  v_current_status text;
  v_short_code text;
  v_batch_id uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Propiedad real de la mascota: SOLO auth.uid(), nunca un parametro del cliente.
  select p.is_archived into v_pet_archived
  from public.pets p
  where p.id = p_pet_id and p.owner_id = v_uid;

  if not found then
    raise exception 'PET_NOT_FOUND';
  end if;
  if v_pet_archived then
    raise exception 'PET_ARCHIVED';
  end if;

  -- Bloquea la fila de la placa: cualquier otra llamada concurrente sobre la
  -- MISMA placa espera aqui y, al continuar, ya ve el estado actualizado.
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

  -- Camino rapido (antes de escribir nada): evita el error de constraint en
  -- el caso comun de "esta mascota ya tiene otra placa viva".
  if exists (
    select 1 from public.qr_tags qt
    where qt.owner_pet_id = p_pet_id and qt.status in ('assigned', 'active', 'suspended')
  ) then
    raise exception 'PET_ALREADY_HAS_TAG';
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
  -- Segunda capa real (carrera genuina entre dos placas distintas para la
  -- misma mascota que pasaron el chequeo rapido casi al mismo tiempo): la
  -- garantia final la da el indice unico parcial, no esta funcion.
  when unique_violation then
    raise exception 'PET_ALREADY_HAS_TAG';
end;
$$;

revoke all on function public.qr_claim_tag(text, uuid) from public, anon;
grant execute on function public.qr_claim_tag(text, uuid) to authenticated;
