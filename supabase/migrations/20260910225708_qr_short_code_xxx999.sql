-- Huellas de Vuelta: el codigo visible de placa pasa al formato XXX-999
-- (3 letras mayusculas + guion + 3 digitos). El admin elige el prefijo por lote
-- (por defecto 'HVD'); cada prefijo tiene su propio contador 000..999.
--
-- Compatibilidad: las placas heredadas HV-L##### se conservan tal cual. El CHECK
-- acepta AMBOS formatos. La URL publica sigue usando public_id aleatorio; el
-- short_code NO es secreto ni autorizacion.

-- 1) Contador por prefijo.
create table public.qr_code_counters (
  prefix text primary key check (prefix ~ '^[A-Z]{3}$'),
  next_seq integer not null default 0 check (next_seq between 0 and 1000),
  updated_at timestamptz not null default now()
);
comment on table public.qr_code_counters is
  'Contador 000..999 por prefijo de 3 letras para el codigo visible XXX-999 de las placas.';
alter table public.qr_code_counters enable row level security;
-- Sin politicas: solo lo usa qr_batch_create (SECURITY DEFINER).
revoke all on table public.qr_code_counters from anon, authenticated;

-- 2) CHECK del short_code: nuevo XXX-999 O heredado HV[-L]#####.
alter table public.qr_tags drop constraint if exists qr_tags_short_code_check;
alter table public.qr_tags
  add constraint qr_tags_short_code_check check (
    short_code ~ '^[A-Z]{3}-[0-9]{3}$'
    or short_code ~ '^HV-L?[0-9]{4,6}$'
  );

-- 3) qr_batch_create con prefijo + contador por prefijo.
drop function if exists public.qr_batch_create(text, integer, text);

create or replace function public.qr_batch_create(
  p_reference text,
  p_quantity integer,
  p_prefix text default 'HVD',
  p_note text default null
)
returns table (batch_id uuid, quantity integer, prefix text, first_code text, last_code text)
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
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    raise exception 'La cantidad debe estar entre 1 y 1000 (el formato XXX-999 admite 1000 codigos por prefijo).';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'La nota del lote no puede superar 300 caracteres.';
  end if;

  -- Reservar el rango del contador de este prefijo (bloqueo de fila).
  insert into public.qr_code_counters (prefix, next_seq)
  values (v_prefix, 0)
  on conflict (prefix) do nothing;

  select next_seq into v_start from public.qr_code_counters
  where prefix = v_prefix for update;

  if v_start + p_quantity > 1000 then
    raise exception 'El prefijo % solo admite % codigos mas (000-999). Usa otro prefijo (p. ej. HVE).',
      v_prefix, 1000 - v_start;
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
    v_prefix || '-' || lpad((v_start + gs)::text, 3, '0'),
    'available'
  from generate_series(0, p_quantity - 1) as gs;

  insert into public.qr_tag_events (tag_id, batch_id, event, actor_id)
  select t.id, t.batch_id, 'generated', v_uid
  from public.qr_tags t where t.batch_id = v_batch;

  select min(t.short_code), max(t.short_code) into v_first, v_last
  from public.qr_tags t where t.batch_id = v_batch;

  return query select v_batch, p_quantity, v_prefix, v_first, v_last;
end;
$$;

revoke all on function public.qr_batch_create(text, integer, text, text) from public, anon;
grant execute on function public.qr_batch_create(text, integer, text, text) to authenticated;

-- La secuencia global anterior queda en desuso (no se elimina para no romper historial).
