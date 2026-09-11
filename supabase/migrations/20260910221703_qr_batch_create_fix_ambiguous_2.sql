-- Fix definitivo: los nombres de columna en el INSERT (batch_id, quantity,
-- first_code, last_code) chocaban con los OUT params. Se separa el INSERT
-- masivo del registro de eventos y se usa un bucle explicito con variables no
-- conflictivas; los OUT params se asignan solo al final.
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

  insert into public.qr_tags (batch_id, public_id, short_code, status)
  select
    v_batch,
    public.gen_pet_public_id(),
    'HV-' || lpad(nextval('public.qr_short_code_seq')::text, 6, '0'),
    'available'
  from generate_series(1, p_quantity);

  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id)
  select t.id, t.batch_id, 'generated', v_uid
  from public.qr_tags t
  where t.batch_id = v_batch;

  select min(t.short_code), max(t.short_code)
    into v_first, v_last
  from public.qr_tags t where t.batch_id = v_batch;

  return query select v_batch, p_quantity, v_first, v_last;
end;
$$;

revoke all on function public.qr_batch_create(text, integer, text) from public, anon;
grant execute on function public.qr_batch_create(text, integer, text) to authenticated;
