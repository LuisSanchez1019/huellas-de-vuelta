-- Fix: 'batch_id' era ambiguo entre el OUT param de la funcion y la columna de
-- la CTE. Se aliasean las columnas de la CTE.
create or replace function public.qr_batch_create(
  p_reference text,
  p_quantity integer,
  p_note text default null
)
returns table (batch_id uuid, quantity integer, first_code text, last_code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ref text := btrim(coalesce(p_reference, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_batch uuid;
  v_first text;
  v_last text;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if char_length(v_ref) < 2 or char_length(v_ref) > 120 then
    raise exception 'La referencia del lote debe tener entre 2 y 120 caracteres.';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 5000 then
    raise exception 'La cantidad debe estar entre 1 y 5000.';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'La nota del lote no puede superar 300 caracteres.';
  end if;

  insert into public.qr_batches (reference, quantity, note, created_by)
  values (v_ref, p_quantity, v_note, v_uid)
  returning id into v_batch;

  with created as (
    insert into public.qr_tags (batch_id, public_id, short_code, status)
    select
      v_batch,
      public.gen_pet_public_id(),
      'HV-' || lpad(nextval('public.qr_short_code_seq')::text, 6, '0'),
      'available'
    from generate_series(1, p_quantity)
    returning id as new_tag_id, batch_id as new_batch_id
  )
  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id)
  select c.new_tag_id, c.new_batch_id, 'generated', v_uid from created c;

  select min(t.short_code), max(t.short_code)
    into v_first, v_last
  from public.qr_tags t where t.batch_id = v_batch;

  batch_id := v_batch;
  quantity := p_quantity;
  first_code := v_first;
  last_code := v_last;
  return next;
end;
$$;

revoke all on function public.qr_batch_create(text, integer, text) from public, anon;
grant execute on function public.qr_batch_create(text, integer, text) to authenticated;
