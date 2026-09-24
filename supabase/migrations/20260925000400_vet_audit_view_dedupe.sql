-- Bloque D: la auditoria de LECTURAS (MEDICAL_VIEW) se compacta en el servidor.
-- Abrir una ficha dispara varias lecturas seguidas (resumen + historia + refrescos);
-- se registra a lo sumo una por profesional y grant cada 60 s. Sigue diciendo
-- quien consulto, cuando y con que grant; solo evita miles de filas repetidas.
-- Las demas acciones (crear, addendum, PDF, emergencia...) se registran SIEMPRE.

create or replace function public._vet_audit_view(p_actor uuid, p_org uuid, p_pet uuid, p_grant uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('vetview:' || p_grant::text, 0));
  if not exists (
    select 1 from public.vet_access_audit a
    where a.actor_id = p_actor and a.grant_id = p_grant and a.action = 'MEDICAL_VIEW'
      and a.at > now() - interval '60 seconds'
  ) then
    insert into public.vet_access_audit (action, actor_id, actor_org_id, pet_id, grant_id, access_level)
    values ('MEDICAL_VIEW', p_actor, p_org, p_pet, p_grant, 'medical');
  end if;
end;
$$;
revoke all on function public._vet_audit_view(uuid, uuid, uuid, uuid) from public, anon, authenticated;

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
           'breed', p.breed, 'sex', p.sex, 'age_value', p.age_value, 'age_unit', p.age_unit,
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

create or replace function public.vet_medical_history(
  p_grant_id uuid, p_limit integer default 10, p_before timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_g record;
begin
  select * into v_g from public._vet_grant_check(p_grant_id, 'can_read_medical');
  if p_before is null then
    perform public._vet_audit_view(v_g.out_user_id, v_g.out_org_id, v_g.out_pet_id, p_grant_id);
  end if;
  return public._vet_history_page(v_g.out_pet_id, p_limit, p_before, v_g.out_org_id);
end;
$$;
revoke all on function public.vet_medical_history(uuid, integer, timestamptz) from public, anon;
grant execute on function public.vet_medical_history(uuid, integer, timestamptz) to authenticated;
