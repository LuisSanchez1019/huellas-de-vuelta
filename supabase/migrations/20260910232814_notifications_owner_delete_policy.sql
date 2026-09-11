-- Permite que cada usuario elimine SUS PROPIAS notificaciones (una por una o en
-- lote). No destructivo: solo añade una policy; la RLS ya restringe por user_id.
create policy "notifications_owner_delete"
on public.notifications for delete to authenticated
using (user_id = (select auth.uid()));
