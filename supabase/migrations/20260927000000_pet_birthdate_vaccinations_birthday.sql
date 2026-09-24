-- Bloque E: fecha de nacimiento + vacunas + mensaje de cumpleaños.
-- Solo mascotas de usuario (public.pets). Sin servicios externos.
--
-- Politica medica vigente (NO se cambia): la informacion medica de una mascota
-- se elimina definitivamente al eliminar la mascota. Por eso toda FK nueva que
-- depende de pets es ON DELETE CASCADE, sin archivo ni copia.

-- ---------------------------------------------------------------------------
-- 1. Fecha de nacimiento. La edad NUNCA se guarda cuando hay fecha: se calcula.
--    El trigger (a) valida la fecha en el servidor y (b) anula age_value/age_unit
--    cuando hay birth_date, para que no quede una edad fija desactualizada.
-- ---------------------------------------------------------------------------
alter table public.pets add column birth_date date;

comment on column public.pets.birth_date is
  'Fecha de nacimiento (opcional). La edad se calcula a partir de ella; si existe, age_value/age_unit se anulan.';

-- "Hoy" para el negocio: fecha calendario de Colombia (sin depender de UTC ni de
-- servicios externos). El cliente calcula con SU fecha local.
create or replace function public._pet_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Bogota')::date $$;
revoke all on function public._pet_today() from public, anon, authenticated;

create or replace function public._pets_validate_birth_date()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.birth_date is not null then
    if new.birth_date > public._pet_today() or new.birth_date < date '1980-01-01' then
      raise exception 'BIRTH_DATE_INVALID';
    end if;
    new.age_value := null;
    new.age_unit := null;
  end if;
  return new;
end;
$$;
revoke all on function public._pets_validate_birth_date() from public, anon, authenticated;

create trigger pets_validate_birth_date
before insert or update of birth_date, age_value, age_unit on public.pets
for each row execute function public._pets_validate_birth_date();

-- Edad derivada (mismos criterios que el cliente): >= 1 anio -> anios; >= 1 mes ->
-- meses; menos de un mes -> NULL (no se muestra "0 meses"). Sin fecha -> edad aproximada guardada.
create or replace function public._pet_age_value(p_birth date, p_value integer, p_unit text)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when p_birth is null then p_value
    when p_birth > public._pet_today() then null
    else (select case when u.y >= 1 then u.y when u.m >= 1 then u.m else null end
          from (select extract(year from age(public._pet_today(), p_birth))::int as y,
                       (extract(year from age(public._pet_today(), p_birth)) * 12
                        + extract(month from age(public._pet_today(), p_birth)))::int as m) u)
  end
$$;
create or replace function public._pet_age_unit(p_birth date, p_value integer, p_unit text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_birth is null then p_unit
    when p_birth > public._pet_today() then null
    else (select case when u.y >= 1 then 'years' when u.m >= 1 then 'months' else null end
          from (select extract(year from age(public._pet_today(), p_birth))::int as y,
                       (extract(year from age(public._pet_today(), p_birth)) * 12
                        + extract(month from age(public._pet_today(), p_birth)))::int as m) u)
  end
$$;
revoke all on function public._pet_age_value(date, integer, text) from public, anon, authenticated;
revoke all on function public._pet_age_unit(date, integer, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Las lecturas que ya exponian la edad la derivan de birth_date (misma forma
--    de salida: age_value / age_unit). birth_date NO se expone publicamente.
-- ---------------------------------------------------------------------------
create or replace function public.list_public_adoption_pets()
returns table(public_id text, name text, species text, species_other text, breed text, age_value integer, age_unit text, sex text, description text, color_primary text, color_secondary text, color_tertiary text, photo_path text, listed_at timestamp with time zone)
language sql
stable
security definer
set search_path = ''
as $$
  select p.public_id, p.name, p.species, p.species_other, p.breed,
         public._pet_age_value(p.birth_date, p.age_value, p.age_unit),
         public._pet_age_unit(p.birth_date, p.age_value, p.age_unit),
         p.sex, p.description,
         p.color_primary, p.color_secondary, p.color_tertiary,
         p.photo_path, p.updated_at
  from public.pets p
  where p.status = 'for_adoption' and not p.is_archived
  order by p.updated_at desc
  limit 40
$$;

create or replace function public.list_public_lost_pets()
returns table(report_id uuid, public_id text, name text, species text, species_other text, breed text, age_value integer, age_unit text, sex text, color_primary text, color_secondary text, color_tertiary text, city text, neighborhood text, details text, photo_path text, reported_at timestamp with time zone)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.public_id, p.name, p.species, p.species_other, p.breed,
         public._pet_age_value(p.birth_date, p.age_value, p.age_unit),
         public._pet_age_unit(p.birth_date, p.age_value, p.age_unit),
         p.sex,
         p.color_primary, p.color_secondary, p.color_tertiary,
         r.city, r.neighborhood, r.details, p.photo_path, r.created_at
  from public.pet_reports r
  join public.pets p on p.id = r.pet_id
  where r.status = 'active' and r.kind = 'lost' and not p.is_archived
  order by r.created_at desc
  limit 60
$$;

create or replace function public.get_public_pet(p_public_id text)
returns table(public_id text, name text, species text, species_other text, breed text, color_primary text, color_secondary text, color_tertiary text, age_value integer, age_unit text, age_text text, sex text, description text, status text, photo_path text, report_id uuid, report_stage text, lost_city text, lost_neighborhood text, lost_details text, reported_at timestamp with time zone, plate_code text, source_kind text, tag_state text, medical_alert boolean, medical_urgent boolean, owner_phone text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tag_status text;
  v_tag_owner_pet uuid;
  v_tag_org_pet uuid;
  v_plate text := null;
  v_owner_pet uuid := null;
  v_org_pet uuid := null;
  v_tag_state text := null;
  v_had_tag boolean := false;
begin
  select t.status, t.owner_pet_id, t.org_pet_id, t.short_code
    into v_tag_status, v_tag_owner_pet, v_tag_org_pet, v_plate
  from public.qr_tags t
  where t.public_id = p_public_id;
  v_had_tag := found;

  if v_had_tag then
    if v_tag_status = 'active' then
      v_owner_pet := v_tag_owner_pet;
      v_org_pet := v_tag_org_pet;
      v_tag_state := 'active';
    else
      return query select
        p_public_id, null::text, null::text, null::text, null::text,
        null::text, null::text, null::text,
        null::integer, null::text, null::text, null::text, null::text,
        null::text, null::text,
        null::uuid, null::text, null::text, null::text, null::text, null::timestamptz,
        v_plate, null::text, v_tag_status,
        false, false, null::text;
      return;
    end if;
  end if;

  if v_owner_pet is not null or not v_had_tag then
    return query
    select p.public_id, p.name, p.species, p.species_other, p.breed,
           p.color_primary, p.color_secondary, p.color_tertiary,
           public._pet_age_value(p.birth_date, p.age_value, p.age_unit),
           public._pet_age_unit(p.birth_date, p.age_value, p.age_unit),
           null::text, p.sex, p.description,
           p.status::text, p.photo_path,
           r.id, r.stage, r.city, r.neighborhood, r.details, r.created_at,
           v_plate, 'owner'::text, coalesce(v_tag_state, 'legacy'),
           coalesce(s.public_alert_enabled
                    and (s.has_condition or s.has_allergy or s.has_medication or s.has_urgent), false),
           coalesce(s.public_alert_enabled and s.public_urgent_enabled and s.has_urgent, false),
           case when r.id is not null and coalesce(pp.allow_public_phone, false)
                then nullif(btrim(coalesce(own.phone, '')), '')
                else null end
    from public.pets p
    left join public.pet_reports r
      on r.pet_id = p.id and r.status = 'active' and p.status = 'lost'
    left join public.pet_medical_summary s on s.owner_pet_id = p.id
    left join public.profiles own on own.id = p.owner_id
    left join public.user_privacy_preferences pp on pp.user_id = p.owner_id
    where ((v_owner_pet is not null and p.id = v_owner_pet)
        or (v_owner_pet is null and p.public_id = p_public_id))
      and not p.is_archived;
    if found then return; end if;
  end if;

  return query
  select op.public_id, op.name, op.species, op.species_other, op.breed,
         null::text, null::text, null::text,
         null::integer, null::text, op.age, op.sex, null::text,
         (case when op.needs_home or op.needs_sponsor then 'for_adoption' else 'at_home' end),
         op.photo_path,
         null::uuid, null::text, null::text, null::text, null::text, null::timestamptz,
         v_plate, 'org'::text, coalesce(v_tag_state, 'legacy'),
         coalesce(s.public_alert_enabled
                  and (s.has_condition or s.has_allergy or s.has_medication or s.has_urgent), false),
         coalesce(s.public_alert_enabled and s.public_urgent_enabled and s.has_urgent, false),
         null::text
  from public.organization_pets op
  left join public.pet_medical_summary s on s.org_pet_id = op.id
  where (v_org_pet is not null and op.id = v_org_pet)
     or (v_org_pet is null and v_owner_pet is null and op.public_id = p_public_id);
end;
$$;

-- vet_medical_overview (Bloque D): misma logica; solo cambia el origen de la edad.
create or replace function public.vet_medical_overview(p_grant_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_g record;
  v_pet jsonb;
  v_summary jsonb;
  v_items jsonb;
  v_count integer;
  v_plate text;
begin
  select * into v_g from public._vet_grant_check(p_grant_id, 'can_read_medical');

  select jsonb_build_object('name', p.name, 'species', p.species, 'species_other', p.species_other,
           'breed', p.breed, 'sex', p.sex,
           'age_value', public._pet_age_value(p.birth_date, p.age_value, p.age_unit),
           'age_unit', public._pet_age_unit(p.birth_date, p.age_value, p.age_unit),
           'status', p.status::text)
    into v_pet
  from public.pets p where p.id = v_g.out_pet_id;

  select jsonb_build_object('has_condition', s.has_condition, 'has_allergy', s.has_allergy,
           'has_medication', s.has_medication, 'has_urgent', s.has_urgent, 'notes', s.notes)
    into v_summary
  from public.pet_medical_summary s where s.owner_pet_id = v_g.out_pet_id;

  select coalesce(jsonb_agg(jsonb_build_object('kind', i.kind, 'label', i.label, 'detail', i.detail,
           'source', i.source) order by i.kind, i.created_at), '[]'::jsonb)
    into v_items
  from public.pet_medical_items i
  join public.pet_medical_summary s on s.id = i.summary_id
  where s.owner_pet_id = v_g.out_pet_id;

  select count(*) into v_count from public.vet_consultations c where c.pet_id = v_g.out_pet_id;

  select t.short_code into v_plate from public.qr_tags t
  where t.owner_pet_id = v_g.out_pet_id and t.status in ('active', 'assigned', 'suspended')
  limit 1;

  perform public._vet_audit_view(v_g.out_user_id, v_g.out_org_id, v_g.out_pet_id, p_grant_id);

  return jsonb_build_object(
    'pet', v_pet, 'summary', v_summary, 'items', v_items,
    'consultation_count', v_count, 'plate_code', v_plate,
    'permissions', to_jsonb(v_g.out_perms), 'expires_at', v_g.out_expires);
end;
$$;
revoke all on function public.vet_medical_overview(uuid) from public, anon;
grant execute on function public.vet_medical_overview(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Vacunas. Dato medico: FK a pets ON DELETE CASCADE (sin archivo ni copia).
--    Lectura por RLS (solo el propietario); escritura SOLO por RPC.
-- ---------------------------------------------------------------------------
create table public.pet_vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  vaccine_name text not null check (char_length(btrim(vaccine_name)) between 2 and 100),
  application_date date not null,
  next_dose_date date,
  lot_number text check (char_length(lot_number) <= 60),
  veterinary_name text check (char_length(veterinary_name) <= 120),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pv_next_after_application check (next_dose_date is null or next_dose_date >= application_date)
);

comment on table public.pet_vaccinations is
  'Vacunas de una mascota de usuario. Dato medico: se elimina en cascada con la mascota; no hay archivo ni copia.';

create index pet_vaccinations_pet_idx on public.pet_vaccinations (pet_id, application_date desc);
-- Doble clic / reintento: la misma vacuna aplicada el mismo dia no se duplica.
create unique index pet_vaccinations_no_dup
  on public.pet_vaccinations (pet_id, lower(vaccine_name), application_date);

create trigger pet_vaccinations_set_updated_at
before update on public.pet_vaccinations
for each row execute procedure public.set_updated_at();

alter table public.pet_vaccinations enable row level security;
revoke all on public.pet_vaccinations from anon, authenticated;
create policy "pv_owner_read"
on public.pet_vaccinations for select to authenticated
using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = (select auth.uid())));
grant select on public.pet_vaccinations to authenticated;

-- Validacion comun (fechas, textos). Devuelve los valores normalizados via OUT.
create or replace function public._pet_vaccination_check(
  p_pet uuid, p_uid uuid, p_name text, p_app date, p_next date, p_lot text, p_vet text, p_notes text,
  out out_name text, out out_lot text, out out_vet text, out out_notes text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_birth date;
begin
  if not exists (select 1 from public.pets pt where pt.id = p_pet and pt.owner_id = p_uid) then
    raise exception 'PET_NOT_FOUND';
  end if;
  out_name := public._vet_clean(p_name, 100, true);
  if char_length(out_name) < 2 then raise exception 'FIELD_TOO_SHORT'; end if;
  out_lot := public._vet_clean(p_lot, 60);
  out_vet := public._vet_clean(p_vet, 120);
  out_notes := public._vet_clean(p_notes, 500);
  if p_app is null or p_app > public._pet_today() or p_app < date '1980-01-01' then
    raise exception 'INVALID_DATE';
  end if;
  select pt.birth_date into v_birth from public.pets pt where pt.id = p_pet;
  if v_birth is not null and p_app < v_birth then
    raise exception 'INVALID_DATE';
  end if;
  if p_next is not null and (p_next < p_app or p_next > p_app + interval '10 years') then
    raise exception 'INVALID_DATE';
  end if;
end;
$$;
revoke all on function public._pet_vaccination_check(uuid, uuid, text, date, date, text, text, text) from public, anon, authenticated;

create or replace function public.pet_vaccination_add(
  p_pet_id uuid, p_vaccine_name text, p_application_date date, p_next_dose_date date default null,
  p_lot_number text default null, p_veterinary_name text default null, p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  c record;
  v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into c from public._pet_vaccination_check(p_pet_id, v_uid, p_vaccine_name, p_application_date,
    p_next_dose_date, p_lot_number, p_veterinary_name, p_notes);
  if (select count(*) from public.pet_vaccinations v where v.pet_id = p_pet_id) >= 200 then
    raise exception 'TOO_MANY';
  end if;
  begin
    insert into public.pet_vaccinations (pet_id, vaccine_name, application_date, next_dose_date, lot_number, veterinary_name, notes)
    values (p_pet_id, c.out_name, p_application_date, p_next_dose_date, c.out_lot, c.out_vet, c.out_notes)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'DUPLICATE_VACCINATION';
  end;
  return v_id;
end;
$$;
revoke all on function public.pet_vaccination_add(uuid, text, date, date, text, text, text) from public, anon;
grant execute on function public.pet_vaccination_add(uuid, text, date, date, text, text, text) to authenticated;

create or replace function public.pet_vaccination_update(
  p_id uuid, p_vaccine_name text, p_application_date date, p_next_dose_date date default null,
  p_lot_number text default null, p_veterinary_name text default null, p_notes text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pet uuid;
  c record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select v.pet_id into v_pet from public.pet_vaccinations v
  join public.pets pt on pt.id = v.pet_id
  where v.id = p_id and pt.owner_id = v_uid
  for update of v;
  if v_pet is null then raise exception 'VACCINATION_NOT_FOUND'; end if;
  select * into c from public._pet_vaccination_check(v_pet, v_uid, p_vaccine_name, p_application_date,
    p_next_dose_date, p_lot_number, p_veterinary_name, p_notes);
  begin
    update public.pet_vaccinations v
       set vaccine_name = c.out_name, application_date = p_application_date, next_dose_date = p_next_dose_date,
           lot_number = c.out_lot, veterinary_name = c.out_vet, notes = c.out_notes
     where v.id = p_id;
  exception when unique_violation then
    raise exception 'DUPLICATE_VACCINATION';
  end;
end;
$$;
revoke all on function public.pet_vaccination_update(uuid, text, date, date, text, text, text) from public, anon;
grant execute on function public.pet_vaccination_update(uuid, text, date, date, text, text, text) to authenticated;

create or replace function public.pet_vaccination_delete(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_deleted integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.pet_vaccinations v
  using public.pets pt
  where v.id = p_id and pt.id = v.pet_id and pt.owner_id = v_uid;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then raise exception 'VACCINATION_NOT_FOUND'; end if;
end;
$$;
revoke all on function public.pet_vaccination_delete(uuid) from public, anon;
grant execute on function public.pet_vaccination_delete(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Mensaje de cumpleaños: UNA vez por dia y por usuario, decidido en el
--    servidor (funciona entre dispositivos y no depende de localStorage).
--    Guarda solo (usuario, ultima fecha saludada): sin mascotas, sin texto,
--    sin datos medicos.
-- ---------------------------------------------------------------------------
create table public.pet_birthday_greetings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_greeted_on date not null
);
comment on table public.pet_birthday_greetings is
  'Ultimo dia en que a un usuario se le mostro el mensaje de cumpleaños de sus mascotas. Solo (usuario, fecha).';
alter table public.pet_birthday_greetings enable row level security;
revoke all on public.pet_birthday_greetings from anon, authenticated;

-- p_local_date = fecha calendario LOCAL del usuario (la calcula el cliente). Se
-- acepta a lo sumo +-1 dia respecto a UTC (husos horarios reales) y nunca una
-- fecha anterior a la ya saludada (mover el reloj hacia atras no lo repite).
-- Cumple = mismo dia y mes que birth_date (29-feb se celebra el 28-feb en anios no
-- bisiestos); el anio determina la edad y se excluye el propio dia de nacimiento.
create or replace function public.claim_birthday_greeting(p_local_date date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_year integer;
  v_leap boolean;
  v_list jsonb;
  v_won integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_local_date is null or abs(p_local_date - (now() at time zone 'utc')::date) > 1 then
    raise exception 'INVALID_DATE';
  end if;
  v_year := extract(year from p_local_date)::integer;
  v_leap := (v_year % 4 = 0 and (v_year % 100 <> 0 or v_year % 400 = 0));

  select jsonb_agg(jsonb_build_object('name', x.name, 'age', x.turning, 'sex', x.sex) order by x.name, x.id)
    into v_list
  from (
    select p.id, p.name, p.sex, (v_year - extract(year from p.birth_date)::integer) as turning
    from public.pets p
    where p.owner_id = v_uid and not p.is_archived and p.birth_date is not null
      and (
        (extract(month from p.birth_date) = extract(month from p_local_date)
         and extract(day from p.birth_date) = extract(day from p_local_date))
        or (not v_leap and extract(month from p.birth_date) = 2 and extract(day from p.birth_date) = 29
            and extract(month from p_local_date) = 2 and extract(day from p_local_date) = 28)
      )
      and v_year - extract(year from p.birth_date)::integer >= 1
  ) x;

  if v_list is null then
    return jsonb_build_object('pets', '[]'::jsonb);      -- nada que celebrar: no se registra nada
  end if;

  -- Reclamo atomico del dia: solo gana UNA llamada (aunque haya varias pestañas o dispositivos).
  insert into public.pet_birthday_greetings as g (user_id, last_greeted_on)
  values (v_uid, p_local_date)
  on conflict (user_id) do update set last_greeted_on = excluded.last_greeted_on
    where g.last_greeted_on < excluded.last_greeted_on;
  get diagnostics v_won = row_count;
  if v_won = 0 then
    return jsonb_build_object('pets', '[]'::jsonb);      -- ya se mostro hoy
  end if;
  return jsonb_build_object('pets', v_list);
end;
$$;
revoke all on function public.claim_birthday_greeting(date) from public, anon;
grant execute on function public.claim_birthday_greeting(date) to authenticated;
