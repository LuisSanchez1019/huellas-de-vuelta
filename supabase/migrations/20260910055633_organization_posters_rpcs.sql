-- Huellas de Vuelta: RPC del modulo POSTERS. Toda escritura pasa por aqui
-- (SECURITY DEFINER, search_path=''). El cliente nunca fija organization_id,
-- status, approved_by, approved_at ni expires_at.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'event_sighting', 'event_found', 'event_found_needs_help',
    'event_org_received', 'event_org_declined', 'org_approved',
    'poster_approved', 'poster_rejected'
  ])
);

-- Constantes de negocio: ventana semanal = 7 dias moviles.
--   POSTER_WEEKLY_LIMIT = 2 posters APROBADOS por organizacion cada 7 dias.
--   POSTER_TTL          = 24 horas de vigencia tras la aprobacion.

create or replace function public._poster_caller_org()
returns table (org_id uuid, org_kind text, org_role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select p.role::text into v_role from public.profiles p where p.id = v_uid;
  if v_role not in ('veterinaria', 'fundacion') then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;
  return query
    select o.id, o.kind, v_role
    from public.organization_profiles o
    where o.owner_id = v_uid;
end;
$$;

revoke all on function public._poster_caller_org() from public;

create or replace function public.poster_upsert(
  p_id uuid,
  p_image_path text,
  p_title text default null,
  p_description text default null,
  p_target_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org_id uuid;
  v_title text;
  v_description text;
  v_target text;
  v_prefix text;
  v_status text;
  v_result uuid;
begin
  select org_id into v_org_id from public._poster_caller_org();
  if v_org_id is null then
    raise exception 'NO_ORG';
  end if;

  if coalesce(btrim(p_image_path), '') = '' or char_length(p_image_path) > 400 then
    raise exception 'INVALID_IMAGE';
  end if;
  v_prefix := v_uid::text || '/';
  if left(p_image_path, char_length(v_prefix)) <> v_prefix then
    raise exception 'INVALID_IMAGE';
  end if;

  v_title := nullif(left(btrim(coalesce(p_title, '')), 80), '');
  v_description := nullif(left(btrim(coalesce(p_description, '')), 300), '');
  v_target := nullif(btrim(coalesce(p_target_url, '')), '');
  if v_target is not null then
    if char_length(v_target) > 500 or lower(v_target) !~ '^https?://[^[:space:]]+$' then
      raise exception 'INVALID_URL';
    end if;
  end if;

  if p_id is null then
    insert into public.organization_posters (
      organization_id, image_path, title, description, target_url, status, created_by
    ) values (
      v_org_id, p_image_path, v_title, v_description, v_target, 'draft', v_uid
    )
    returning id into v_result;

    insert into public.organization_poster_events (poster_id, organization_id, event, actor_id)
    values (v_result, v_org_id, 'created', v_uid);
    return v_result;
  end if;

  select status into v_status
  from public.organization_posters
  where id = p_id and organization_id = v_org_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_status not in ('draft', 'rejected') then
    raise exception 'NOT_EDITABLE';
  end if;

  update public.organization_posters
     set image_path = p_image_path,
         title = v_title,
         description = v_description,
         target_url = v_target,
         status = 'draft',
         rejection_reason = null,
         submitted_at = null
   where id = p_id;
  return p_id;
end;
$$;

revoke all on function public.poster_upsert(uuid, text, text, text, text) from public;
grant execute on function public.poster_upsert(uuid, text, text, text, text) to authenticated;

create or replace function public.poster_submit(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_status text;
  v_image text;
  v_approved_7d integer;
  v_pending integer;
begin
  select org_id into v_org_id from public._poster_caller_org();
  if v_org_id is null then
    raise exception 'NO_ORG';
  end if;

  select status, image_path into v_status, v_image
  from public.organization_posters
  where id = p_id and organization_id = v_org_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_status not in ('draft', 'rejected') then
    raise exception 'NOT_SUBMITTABLE';
  end if;
  if coalesce(btrim(v_image), '') = '' then
    raise exception 'INVALID_IMAGE';
  end if;

  perform public._expire_stale_posters(v_org_id);

  select count(*) into v_approved_7d
  from public.organization_poster_events
  where organization_id = v_org_id
    and event = 'approved'
    and created_at > now() - interval '7 days';
  if v_approved_7d >= 2 then
    raise exception 'WEEKLY_LIMIT';
  end if;

  select count(*) into v_pending
  from public.organization_posters
  where organization_id = v_org_id and status = 'pending' and id <> p_id;
  if v_pending > 0 then
    raise exception 'ALREADY_PENDING';
  end if;

  update public.organization_posters
     set status = 'pending', submitted_at = now(), rejection_reason = null
   where id = p_id;

  insert into public.organization_poster_events (poster_id, organization_id, event, actor_id)
  values (p_id, v_org_id, 'submitted', (select auth.uid()));
end;
$$;

revoke all on function public.poster_submit(uuid) from public;
grant execute on function public.poster_submit(uuid) to authenticated;

create or replace function public.poster_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public._poster_caller_org();
  if v_org_id is null then
    raise exception 'NO_ORG';
  end if;

  perform 1 from public.organization_posters
  where id = p_id and organization_id = v_org_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  insert into public.organization_poster_events (poster_id, organization_id, event, actor_id)
  values (p_id, v_org_id, 'deleted', (select auth.uid()));

  delete from public.organization_posters where id = p_id;
end;
$$;

revoke all on function public.poster_delete(uuid) from public;
grant execute on function public.poster_delete(uuid) to authenticated;

create or replace function public.poster_my_quota()
returns table (
  approved_last_7d integer,
  weekly_limit integer,
  has_live boolean,
  has_pending boolean,
  next_slot_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public._poster_caller_org();
  if v_org_id is null then
    raise exception 'NO_ORG';
  end if;
  perform public._expire_stale_posters(v_org_id);

  return query
  select
    (select count(*)::integer from public.organization_poster_events e
       where e.organization_id = v_org_id and e.event = 'approved'
         and e.created_at > now() - interval '7 days'),
    2,
    exists (select 1 from public.organization_posters p
       where p.organization_id = v_org_id and p.status = 'approved' and p.expires_at > now()),
    exists (select 1 from public.organization_posters p
       where p.organization_id = v_org_id and p.status = 'pending'),
    (select min(e.created_at) + interval '7 days'
       from (select e.created_at from public.organization_poster_events e
               where e.organization_id = v_org_id and e.event = 'approved'
                 and e.created_at > now() - interval '7 days'
               order by e.created_at desc limit 2) e);
end;
$$;

revoke all on function public.poster_my_quota() from public;
grant execute on function public.poster_my_quota() to authenticated;

create or replace function public.poster_admin_review(
  p_id uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org_id uuid;
  v_owner uuid;
  v_org_name text;
  v_status text;
  v_org_ok boolean;
  v_approved_7d integer;
  v_reason text;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  if p_action not in ('approve', 'reject', 'deactivate') then
    raise exception 'INVALID_ACTION';
  end if;

  select p.organization_id, p.status, o.owner_id, o.name,
         (o.status = 'published' and o.approval_status = 'approved' and o.is_active)
    into v_org_id, v_status, v_owner, v_org_name, v_org_ok
  from public.organization_posters p
  join public.organization_profiles o on o.id = p.organization_id
  where p.id = p_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  v_reason := nullif(left(btrim(coalesce(p_reason, '')), 300), '');

  if p_action = 'approve' then
    if v_status <> 'pending' then
      raise exception 'NOT_PENDING';
    end if;
    if not v_org_ok then
      raise exception 'ORG_NOT_PUBLIC';
    end if;

    perform public._expire_stale_posters(v_org_id);

    select count(*) into v_approved_7d
    from public.organization_poster_events
    where organization_id = v_org_id and event = 'approved'
      and created_at > now() - interval '7 days';
    if v_approved_7d >= 2 then
      raise exception 'WEEKLY_LIMIT';
    end if;

    begin
      update public.organization_posters
         set status = 'approved',
             approved_at = now(),
             expires_at = now() + interval '24 hours',
             approved_by = v_uid,
             rejection_reason = null
       where id = p_id;
    exception when unique_violation then
      raise exception 'ALREADY_LIVE';
    end;

    insert into public.organization_poster_events (poster_id, organization_id, event, actor_id)
    values (p_id, v_org_id, 'approved', v_uid);

    insert into public.notifications (user_id, type, title, body)
    values (
      v_owner, 'poster_approved',
      'Tu poster fue aprobado',
      v_org_name || ': tu poster ya aparece en la Landing de Huellas de Vuelta durante 24 horas.'
    );

  elsif p_action = 'reject' then
    if v_status <> 'pending' then
      raise exception 'NOT_PENDING';
    end if;

    update public.organization_posters
       set status = 'rejected',
           rejection_reason = v_reason,
           approved_at = null,
           expires_at = null,
           approved_by = null
     where id = p_id;

    insert into public.organization_poster_events (poster_id, organization_id, event, actor_id, reason)
    values (p_id, v_org_id, 'rejected', v_uid, v_reason);

    insert into public.notifications (user_id, type, title, body)
    values (
      v_owner, 'poster_rejected',
      'Tu poster no fue aprobado',
      coalesce('Motivo: ' || v_reason, 'Revisa el motivo en el panel de Posters de tu organizacion.')
    );

  else -- deactivate
    if v_status <> 'approved' then
      raise exception 'NOT_ACTIVE';
    end if;
    update public.organization_posters set status = 'inactive' where id = p_id;
    insert into public.organization_poster_events (poster_id, organization_id, event, actor_id, reason)
    values (p_id, v_org_id, 'deactivated', v_uid, v_reason);
  end if;
end;
$$;

revoke all on function public.poster_admin_review(uuid, text, text) from public;
grant execute on function public.poster_admin_review(uuid, text, text) to authenticated;

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
stable
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

revoke all on function public.poster_admin_list() from public;
grant execute on function public.poster_admin_list() to authenticated;

create or replace function public.list_public_posters()
returns table (
  id uuid,
  organization_id uuid,
  image_path text,
  title text,
  description text,
  target_url text,
  org_name text,
  org_kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  select picked.id, picked.organization_id, picked.image_path, picked.title,
         picked.description, picked.target_url, picked.org_name, picked.org_kind
  from (
    select distinct on (p.organization_id)
      p.id, p.organization_id, p.image_path, p.title, p.description, p.target_url,
      o.name as org_name, o.kind as org_kind, p.approved_at
    from public.organization_posters p
    join public.organization_profiles o on o.id = p.organization_id
    where p.status = 'approved'
      and p.expires_at > now()
      and o.status = 'published'
      and o.approval_status = 'approved'
      and o.is_active
    order by p.organization_id, p.approved_at desc
  ) picked
  order by md5(picked.organization_id::text || floor(extract(epoch from now()) / 10800)::text)
  limit 4
$$;

revoke all on function public.list_public_posters() from public;
grant execute on function public.list_public_posters() to anon, authenticated;

comment on function public.list_public_posters() is
  'Hasta 4 posters vigentes para la Landing, maximo 1 por organizacion, rotacion cada 3 h. Valida tambien el estado de la organizacion (activa/aprobada/publicada).';
