-- Fix: los parametros OUT (policy_type, policy_version) del RETURNS TABLE
-- colisionaban con las columnas homonimas en el WHERE interno
-- ("column reference policy_type is ambiguous"). Se cualifica con alias.
create or replace function public.my_pending_policy_consent()
returns table (policy_type text, policy_version text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ver text := public._current_data_policy_version();
begin
  if v_uid is null then return; end if;
  if not exists (
    select 1 from public.user_policy_consents c
    where c.user_id = v_uid
      and c.policy_type = 'data_processing'
      and c.policy_version = v_ver
  ) then
    return query select 'data_processing'::text, v_ver;
  end if;
end;
$$;
revoke all on function public.my_pending_policy_consent() from public, anon;
grant execute on function public.my_pending_policy_consent() to authenticated;
