-- BUG: /admin/posters no mostraba los posters pendientes.
--
-- Causa: public.poster_admin_list() estaba declarada STABLE, pero su cuerpo llama
-- a _expire_stale_posters() que ejecuta un UPDATE. PostgREST ejecuta las funciones
-- STABLE/IMMUTABLE en una transacción de SOLO LECTURA, así que la llamada del
-- administrador desde el navegador fallaba con:
--   "cannot execute UPDATE in a read-only transaction"
-- (Postgres además bloquea DML dentro de funciones no VOLATILE con
--  ERROR 0A000: "UPDATE is not allowed in a non-volatile function".)
-- -> adminListPosters() lanzaba -> la página quedaba en estado de error y no
-- mostraba la cola. En pruebas SQL directas no se notó porque corrían en
-- transacción de lectura/escritura.
--
-- Corrección MÍNIMA y sin tocar seguridad: la función pasa a VOLATILE (que es lo
-- correcto porque sí escribe al reconciliar posters vencidos). El guard
-- is_admin(), la RLS y el acceso exclusivo de admin no cambian.

create or replace function public.poster_admin_list()
returns table (
  id uuid,
  organization_id uuid,
  org_name text,
  org_kind text,
  org_category text,
  owner_email text,
  image_path text,
  title text,
  description text,
  target_url text,
  status text,
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  is_live boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  perform public._expire_stale_posters(null);

  return query
  select p.id, p.organization_id, o.name, o.kind, o.category, u.email::text,
         p.image_path, p.title, p.description, p.target_url, p.status,
         p.rejection_reason, p.submitted_at, p.approved_at, p.expires_at, p.created_at,
         (p.status = 'approved' and p.expires_at > now())
  from public.organization_posters p
  join public.organization_profiles o on o.id = p.organization_id
  left join auth.users u on u.id = o.owner_id
  order by
    case p.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    coalesce(p.submitted_at, p.created_at) desc;
end;
$$;

revoke all on function public.poster_admin_list() from public, anon;
grant execute on function public.poster_admin_list() to authenticated;
