-- REPARACION (idempotente): durante las pruebas de una fase anterior, las placas
-- heredadas (lote is_system) quedaron 'available' y desvinculadas de su mascota,
-- rompiendo el perfil publico /m/<public_id>. Se restauran a 'active' + ligadas a
-- la mascota cuyo public_id coincide con el de la placa heredada.
-- No destructivo: no toca placas ya asignadas ni codigos.
do $$
declare r record;
begin
  for r in
    select t.id,
      (select p.id from public.pets p where p.public_id = t.public_id) as pet_id
    from public.qr_tags t
    join public.qr_batches b on b.id = t.batch_id
    where b.is_system and t.status = 'available'
      and t.owner_pet_id is null and t.org_pet_id is null
  loop
    if r.pet_id is not null then
      update public.qr_tags
        set status = 'active', owner_pet_id = r.pet_id, assigned_at = now()
        where id = r.id;
      insert into public.qr_tag_events (tag_id, batch_id, event, owner_pet_id, reason)
      select r.id, batch_id, 'assigned', r.pet_id, 'reparacion placas heredadas'
      from public.qr_tags where id = r.id;
      insert into public.qr_tag_events (tag_id, batch_id, event, owner_pet_id, reason)
      select r.id, batch_id, 'activated', r.pet_id, 'reparacion placas heredadas'
      from public.qr_tags where id = r.id;
    end if;
  end loop;
end $$;
