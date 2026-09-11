-- El primer codigo de cada prefijo es XXX-001 (no XXX-000). Rango 001..999.
create or replace function public.qr_batch_create(
  p_reference text,
  p_quantity integer,
  p_prefix text default 'HVD',
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
  v_ref text := btrim(coalesce(p_reference, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_prefix text := upper(btrim(coalesce(p_prefix, 'HVD')));
  v_batch uuid;
  v_start integer;
  v_first text;
  v_last text;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if char_length(v_ref) < 2 or char_length(v_ref) > 120 then
    raise exception 'La referencia del lote debe tener entre 2 y 120 caracteres.';
  end if;
  if v_prefix !~ '^[A-Z]{3}$' then
    raise exception 'El prefijo debe ser exactamente 3 letras (A-Z). Ej: HVD.';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'La cantidad debe estar entre 1 y 999 (el formato XXX-999 admite 999 codigos por prefijo).';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'La nota del lote no puede superar 300 caracteres.';
  end if;

  insert into public.qr_code_counters (prefix, next_seq)
  values (v_prefix, 0)
  on conflict (prefix) do nothing;

  select c.next_seq into v_start from public.qr_code_counters c
  where c.prefix = v_prefix for update;

  if v_start + p_quantity > 999 then
    raise exception 'El prefijo % solo admite % codigos mas (001-999). Usa otro prefijo (p. ej. HVE).',
      v_prefix, 999 - v_start;
  end if;

  update public.qr_code_counters c
    set next_seq = v_start + p_quantity, updated_at = now()
  where c.prefix = v_prefix;

  insert into public.qr_tags (batch_id, public_id, short_code, status)
  select
    v_batch,
    public.gen_pet_public_id(),
    v_prefix || '-' || lpad((v_start + gs + 1)::text, 3, '0'),
    'available'
  from generate_series(0, p_quantity - 1) as gs;
  -- (v_batch se fija justo antes)

  update public.qr_tags set batch_id = v_batch where false; -- no-op para claridad
  return;
end;
$$;
