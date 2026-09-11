-- §23: el admin usa el MISMO buzon de notificaciones. Se conservan avisos
-- administrativos especificos (nueva organizacion pendiente, nuevo pedido de
-- placa) diferenciados por TIPO, no por un menu aparte. Se implementan con
-- triggers para no tocar las funciones grandes.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'event_sighting', 'event_found', 'event_found_needs_help',
    'event_org_received', 'event_org_declined', 'org_approved',
    'poster_approved', 'poster_rejected',
    'admin_new_org', 'admin_new_plate_order'
  ])
);

create or replace function public._notify_admins(p_type text, p_title text, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, title, body)
  select p.id, p_type, p_title, p_body
  from public.profiles p where p.is_admin;
end;
$$;
revoke all on function public._notify_admins(text, text, text) from public, anon, authenticated;

-- Trigger: nueva organizacion en estado pendiente de aprobacion.
create or replace function public._notify_admins_new_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approval_status = 'pending' then
    perform public._notify_admins(
      'admin_new_org',
      'Nueva organizacion por revisar',
      coalesce(new.name, 'Una organizacion') || ' (' || new.kind || ') solicito aparecer en Huellas de Vuelta.'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists organization_profiles_notify_admins on public.organization_profiles;
create trigger organization_profiles_notify_admins
after insert on public.organization_profiles
for each row execute procedure public._notify_admins_new_org();

-- Trigger: nuevo pedido de placa.
create or replace function public._notify_admins_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._notify_admins(
    'admin_new_plate_order',
    'Nuevo pedido de placa',
    'Pedido ' || new.reference || ' creado. Revisa el pago y asigna la placa desde Administracion > Pedidos.'
  );
  return new;
end;
$$;
drop trigger if exists plate_orders_notify_admins on public.plate_orders;
create trigger plate_orders_notify_admins
after insert on public.plate_orders
for each row execute procedure public._notify_admins_new_order();
