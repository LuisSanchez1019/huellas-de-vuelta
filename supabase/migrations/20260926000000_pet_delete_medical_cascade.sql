-- Politica definitiva de eliminacion de mascotas (decision del propietario del
-- producto): "La historia clinica pertenece al registro de la mascota y se
-- elimina definitivamente cuando el propietario elimina la mascota. Huellas de
-- Vuelta no conserva una copia historica despues de esa eliminacion."
--
-- Estado ANTES de esta migracion al ejecutar DELETE FROM pets:
--   * vet_consultations / _medications / _addenda / vet_access_grants  -> CASCADE (ok)
--   * pet_medical_summary / pet_medical_items                          -> CASCADE (ok)
--   * vet_access_audit.pet_id  -> SET NULL  (DEJABA filas huerfanas con org,
--     profesional, metodo y el motivo libre de emergencia)  <- se corrige aqui
--   * qr_tags.owner_pet_id -> SET NULL, pero con la placa en estado
--     assigned/active/suspended el CHECK qr_tags_linked_has_pet lo rechazaba y
--     el DELETE completo FALLABA (error preexistente: no se podia eliminar una
--     mascota con placa activa, ni cerrar una cuenta que la tuviera)  <- se corrige aqui
--   * plate_orders.owner_pet_id -> RESTRICT (registro comercial con datos de
--     envio; NO se modifica aqui, la eliminacion sigue bloqueada mientras exista
--     un pedido de placa).

-- 1. La auditoria medica de una mascota se elimina CON la mascota.
alter table public.vet_access_audit
  drop constraint vet_access_audit_pet_id_fkey,
  add constraint vet_access_audit_pet_id_fkey
    foreign key (pet_id) references public.pets(id) on delete cascade;

-- 2. Al eliminar una mascota, sus placas vigentes se liberan (mismo efecto que
--    la accion "unassign" de administracion: la placa fisica queda disponible
--    para reclamarse de nuevo). Todo en la misma transaccion del DELETE.
create or replace function public._pets_release_qr_tags_before_delete()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  with released as (
    update public.qr_tags t
       set status = 'available', owner_pet_id = null, org_pet_id = null, assigned_at = null
     where t.owner_pet_id = old.id
       and t.status in ('assigned', 'active', 'suspended')
    returning t.id, t.batch_id
  )
  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id, owner_pet_id, reason)
  select r.id, r.batch_id, 'unassigned', (select auth.uid()), old.id, 'Mascota eliminada por su propietario'
  from released r;
  return old;
end;
$$;
revoke all on function public._pets_release_qr_tags_before_delete() from public, anon, authenticated;

create trigger pets_release_qr_tags_before_delete
before delete on public.pets
for each row execute function public._pets_release_qr_tags_before_delete();
