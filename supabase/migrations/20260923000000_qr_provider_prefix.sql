-- Bloque B: prefijo de 3 letras que el ADMIN asigna a cada proveedor para sus
-- lotes de QR. Nullable (no todo proveedor tiene uno todavia). UNIQUE: dos
-- proveedores nunca comparten el mismo contador de qr_code_counters.
alter table public.organization_profiles
  add column qr_prefix text;

alter table public.organization_profiles
  add constraint organization_profiles_qr_prefix_check
    check (qr_prefix is null or qr_prefix ~ '^[A-Z]{3}$');

alter table public.organization_profiles
  add constraint organization_profiles_qr_prefix_key unique (qr_prefix);

-- El propio dueño de la organizacion (via upsertOrgProfileRow, RLS org_profiles_owner_all)
-- NO debe poder auto-asignarse un prefijo: se bloquea igual que approval_status/is_active,
-- solo un admin (via admin_set_provider_qr_prefix, mas abajo) puede cambiarlo.
create or replace function public.lock_org_approval_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    new.approval_status  := old.approval_status;
    new.is_active        := old.is_active;
    new.verified_at      := old.verified_at;
    new.verified_by      := old.verified_by;
    new.rejection_reason := old.rejection_reason;
    new.qr_prefix         := old.qr_prefix;
  end if;
  return new;
end;
$function$;
