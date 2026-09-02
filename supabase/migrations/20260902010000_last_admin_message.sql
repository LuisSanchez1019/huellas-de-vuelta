-- Ajuste de redacción del mensaje al proteger al último administrador.
create or replace function public.set_user_admin(
  p_user_id uuid,
  p_make_admin boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_currently_admin boolean;
  v_admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  select is_admin into v_is_currently_admin from public.profiles where id = p_user_id;
  if v_is_currently_admin is null then
    raise exception 'El usuario no existe.';
  end if;

  if p_make_admin = false and v_is_currently_admin then
    select count(*) into v_admin_count from public.profiles where is_admin;
    if v_admin_count <= 1 then
      raise exception 'No puedes quitar el rol al ultimo administrador del sistema.';
    end if;
  end if;

  update public.profiles set is_admin = p_make_admin where id = p_user_id;
end;
$$;
