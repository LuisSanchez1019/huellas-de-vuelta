-- Huellas de Vuelta: migracion NO destructiva de las mascotas que ya tienen
-- public_id. Se materializa una placa "heredada" por cada mascota existente:
--   * public_id  = el MISMO public_id que ya tiene la mascota (los enlaces /m/
--                  ya compartidos siguen funcionando exactamente igual).
--   * short_code = HV-L##### (prefijo L de "legado").
--   * status     = 'active' (el perfil publico responde igual que hoy).
-- No se regenera ni se borra ningun identificador.

-- Un lote de sistema puede tener 0 unidades (p. ej. si no hay mascotas previas).
alter table public.qr_batches drop constraint qr_batches_quantity_check;
alter table public.qr_batches
  add constraint qr_batches_quantity_check check (quantity between 0 and 5000);

do $$
declare
  v_batch uuid;
begin
  if not exists (
    select 1 from public.pets p
    where not exists (select 1 from public.qr_tags t where t.owner_pet_id = p.id)
    union all
    select 1 from public.organization_pets op
    where not exists (select 1 from public.qr_tags t where t.org_pet_id = op.id)
  ) then
    return;
  end if;

  insert into public.qr_batches (reference, quantity, note, is_system)
  values ('Placas heredadas (migracion QR)', 0,
          'Generado automaticamente: una placa por cada mascota que ya tenia public_id antes del sistema de placas.',
          true)
  returning id into v_batch;

  with src as (
    select p.id as pet_id, p.public_id,
           row_number() over (order by p.created_at) as rn
    from public.pets p
    where not exists (select 1 from public.qr_tags t where t.owner_pet_id = p.id)
  ),
  ins as (
    insert into public.qr_tags (batch_id, public_id, short_code, status, owner_pet_id, assigned_at)
    select v_batch, s.public_id,
           'HV-L' || lpad(s.rn::text, 5, '0'),
           'active', s.pet_id, now()
    from src s
    returning id, owner_pet_id
  )
  insert into public.qr_tag_events (tag_id, batch_id, event, owner_pet_id)
  select i.id, v_batch, e.event, i.owner_pet_id
  from ins i
  cross join (values ('generated'), ('assigned'), ('activated')) as e(event);

  with src as (
    select op.id as pet_id, op.public_id,
           row_number() over (order by op.created_at) as rn
    from public.organization_pets op
    where not exists (select 1 from public.qr_tags t where t.org_pet_id = op.id)
  ),
  ins as (
    insert into public.qr_tags (batch_id, public_id, short_code, status, org_pet_id, assigned_at)
    select v_batch, s.public_id,
           'HV-LO' || lpad(s.rn::text, 4, '0'),
           'active', s.pet_id, now()
    from src s
    returning id, org_pet_id
  )
  insert into public.qr_tag_events (tag_id, batch_id, event, org_pet_id)
  select i.id, v_batch, e.event, i.org_pet_id
  from ins i
  cross join (values ('generated'), ('assigned'), ('activated')) as e(event);

  update public.qr_batches
     set quantity = (select count(*) from public.qr_tags where batch_id = v_batch)
   where id = v_batch;
end $$;
