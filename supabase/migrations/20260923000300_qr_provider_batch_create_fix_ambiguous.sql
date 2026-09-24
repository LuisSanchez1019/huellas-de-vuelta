-- Fix: la columna de retorno "prefix" colisiona con referencias a la columna
-- qr_code_counters.prefix dentro del cuerpo de la funcion (PL/pgSQL la trata
-- como variable, igual que le paso antes a qr_batch_create de admin, resuelto
-- ahi renombrando a "code_prefix"). Se aplica el mismo fix aqui.
drop function public.qr_provider_batch_create(integer, text);

create function public.qr_provider_batch_create(
  p_quantity integer,
  p_note text default null
)
returns table (batch_id uuid, quantity integer, code_prefix text, first_code text, last_code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_prefix text;
  v_org_name text;
  v_ref text;
  v_batch uuid;
  v_start integer;
  v_first text;
  v_last text;
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and role = 'proveedor'
  ) then
    raise exception 'No autorizado.';
  end if;

  if p_quantity is null or p_quantity not in (1, 5, 10, 20) then
    raise exception 'La cantidad debe ser 1, 5, 10 o 20.';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'La nota del lote no puede superar 300 caracteres.';
  end if;

  select o.qr_prefix, o.name into v_prefix, v_org_name
  from public.organization_profiles o
  where o.owner_id = v_uid and o.kind = 'proveedor';

  if v_prefix is null then
    raise exception 'Tu cuenta todavia no tiene un prefijo de codigo asignado. Contacta al equipo de Huellas de Vuelta.';
  end if;

  v_ref := coalesce(v_org_name, 'Proveedor') || ' · ' || to_char(now(), 'YYYY-MM-DD HH24:MI');

  insert into public.qr_code_counters (prefix, next_seq)
  values (v_prefix, 0)
  on conflict (prefix) do nothing;

  select next_seq into v_start from public.qr_code_counters
  where prefix = v_prefix for update;

  if v_start + p_quantity > 999 then
    raise exception 'Tu prefijo % ya no tiene codigos disponibles suficientes. Contacta al equipo de Huellas de Vuelta.', v_prefix;
  end if;

  update public.qr_code_counters
    set next_seq = v_start + p_quantity, updated_at = now()
  where prefix = v_prefix;

  insert into public.qr_batches (reference, quantity, note, created_by)
  values (v_ref, p_quantity, v_note, v_uid)
  returning id into v_batch;

  insert into public.qr_tags (batch_id, public_id, short_code, status)
  select
    v_batch,
    public.gen_pet_public_id(),
    v_prefix || '-' || lpad((v_start + gs + 1)::text, 3, '0'),
    'available'
  from generate_series(0, p_quantity - 1) as gs;

  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id)
  select t.id, t.batch_id, 'generated', v_uid
  from public.qr_tags t where t.batch_id = v_batch;

  select min(t.short_code), max(t.short_code) into v_first, v_last
  from public.qr_tags t where t.batch_id = v_batch;

  batch_id := v_batch;
  quantity := p_quantity;
  code_prefix := v_prefix;
  first_code := v_first;
  last_code := v_last;
  return next;
end;
$$;

revoke all on function public.qr_provider_batch_create(integer, text) from public, anon;
grant execute on function public.qr_provider_batch_create(integer, text) to authenticated;
