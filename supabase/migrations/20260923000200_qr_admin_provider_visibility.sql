-- Bloque B: visibilidad de proveedores para ADMIN, sin abrir ningun acceso
-- nuevo a qr_admin_* (siguen exigiendo is_admin() exactamente igual).

-- ---------------------------------------------------------------------------
-- Asignar el prefijo QR de un proveedor (unico camino para escribirlo: el
-- trigger lock_org_approval_columns bloquea el resto).
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_provider_qr_prefix(
  p_org_id uuid,
  p_prefix text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_prefix text := upper(btrim(coalesce(p_prefix, '')));
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if v_prefix !~ '^[A-Z]{3}$' then
    raise exception 'El prefijo debe ser exactamente 3 letras (A-Z). Ej: PRV.';
  end if;
  if not exists (
    select 1 from public.organization_profiles where id = p_org_id and kind = 'proveedor'
  ) then
    raise exception 'La organizacion no existe o no es un proveedor.';
  end if;

  update public.organization_profiles
    set qr_prefix = v_prefix
  where id = p_org_id;
exception
  when unique_violation then
    raise exception 'Ese prefijo ya esta asignado a otro proveedor.';
end;
$$;

revoke all on function public.admin_set_provider_qr_prefix(uuid, text) from public, anon;
grant execute on function public.admin_set_provider_qr_prefix(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_list_organizations: agrega qr_prefix (solo lectura, ya visible para
-- admin de cualquier forma via la fila de organization_profiles).
-- ---------------------------------------------------------------------------
drop function public.admin_list_organizations();

create function public.admin_list_organizations()
returns table (
  id uuid, owner_id uuid, owner_display_name text, owner_email text,
  kind text, category text, name text, slug text, description text,
  phone text, whatsapp text, email text, address text, city text, neighborhood text,
  lat double precision, lng double precision,
  status text, approval_status text, is_active boolean,
  verified_at timestamptz, rejection_reason text, created_at timestamptz,
  qr_prefix text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  return query
    select o.id, o.owner_id, p.display_name, u.email::text,
           o.kind, o.category, o.name, o.slug, o.description,
           o.phone, o.whatsapp, o.email, o.address, o.city, o.neighborhood,
           o.lat, o.lng, o.status, o.approval_status, o.is_active,
           o.verified_at, o.rejection_reason, o.created_at,
           o.qr_prefix
    from public.organization_profiles o
    join public.profiles p on p.id = o.owner_id
    left join auth.users u on u.id = o.owner_id
    order by
      case o.approval_status when 'pending' then 0 when 'approved' then 1 else 2 end,
      o.created_at desc;
end;
$function$;

revoke all on function public.admin_list_organizations() from public, anon;
grant execute on function public.admin_list_organizations() to authenticated;

-- ---------------------------------------------------------------------------
-- qr_admin_list_batches: agrega quien lo creo (rol + nombre) para que ADMIN
-- distinga lotes propios / del sistema / de cada proveedor. Sigue exigiendo
-- is_admin(); ningun proveedor gana acceso nuevo con este cambio.
-- ---------------------------------------------------------------------------
drop function public.qr_admin_list_batches();

create function public.qr_admin_list_batches()
returns table (
  id uuid, reference text, quantity integer, note text, is_system boolean,
  created_at timestamptz,
  created_by_role text, created_by_name text,
  total bigint, available bigint, assigned bigint, active bigint,
  suspended bigint, replaced bigint, annulled bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  return query
  select b.id, b.reference, b.quantity, b.note, b.is_system, b.created_at,
         p.role::text,
         coalesce(org.name, p.display_name),
         count(t.id),
         count(t.id) filter (where t.status = 'available'),
         count(t.id) filter (where t.status = 'assigned'),
         count(t.id) filter (where t.status = 'active'),
         count(t.id) filter (where t.status = 'suspended'),
         count(t.id) filter (where t.status = 'replaced'),
         count(t.id) filter (where t.status = 'annulled')
  from public.qr_batches b
  left join public.profiles p on p.id = b.created_by
  left join public.organization_profiles org on org.owner_id = b.created_by and org.kind = 'proveedor'
  left join public.qr_tags t on t.batch_id = b.id
  group by b.id, p.role, org.name, p.display_name
  order by b.created_at desc;
end;
$function$;

revoke all on function public.qr_admin_list_batches() from public, anon;
grant execute on function public.qr_admin_list_batches() to authenticated;
