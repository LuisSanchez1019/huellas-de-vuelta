-- Bloque D: identificacion veterinaria + autorizacion del propietario + historia clinica.
--
-- REGLA: IDENTIFICACION != AUTORIZACION. Un QR / codigo de barras / short_code /
-- public_id solo IDENTIFICA una placa (qr_tags). Nunca da acceso medico. El acceso
-- medico exige un grant vigente (vet_access_grants) concedido por el propietario.
--
-- Este archivo solo crea estructuras. Toda lectura/escritura pasa por RPC
-- SECURITY DEFINER (siguientes migraciones). Ninguna tabla nueva concede
-- INSERT/UPDATE/DELETE a anon ni a authenticated.
--
-- Alcance: solo mascotas de usuario (public.pets). organization_pets queda fuera.
-- NO se modifican qr_tags, qr_tag_events, pets, get_public_pet ni qr_claim_tag.

-- ---------------------------------------------------------------------------
-- 1. vet_access_grants: autorizacion temporal del propietario.
--    "expired" NO se guarda: se deriva de expires_at <= now() en cada consulta.
--    organizacion != profesional: se guardan ambos (hoy la relacion es 1:1).
-- ---------------------------------------------------------------------------
create table public.vet_access_grants (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organization_profiles(id) on delete cascade,
  vet_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'revoked', 'denied')),
  requested_permissions text[] not null,
  granted_permissions text[] not null default '{}',
  requested_duration text not null check (requested_duration in ('30m', '1h', '24h')),
  granted_duration text check (granted_duration in ('30m', '1h', '24h')),
  reason text check (char_length(reason) <= 300),
  identification_method text check (identification_method in ('qr', 'barcode', 'manual', 'nfc')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  constraint vag_requested_known check (
    cardinality(requested_permissions) between 1 and 5
    and requested_permissions <@ array['can_read_medical', 'can_create_consultation',
      'can_add_diagnosis', 'can_add_treatment', 'can_generate_pdf']::text[]
  ),
  constraint vag_granted_subset check (granted_permissions <@ requested_permissions),
  constraint vag_status_shape check (
    (status in ('pending', 'denied') and expires_at is null and granted_duration is null
       and cardinality(granted_permissions) = 0)
    or (status in ('active', 'revoked') and expires_at is not null and granted_duration is not null
       and cardinality(granted_permissions) >= 1)
  ),
  constraint vag_revoked_shape check ((status = 'revoked') = (revoked_at is not null))
);

comment on table public.vet_access_grants is
  'Autorizacion temporal del propietario a una veterinaria (organizacion + profesional) sobre una mascota de usuario. Permisos explicitos. "expired" no se guarda: se deriva de expires_at <= now(). Toda escritura por RPC.';

-- Una sola solicitud pendiente por mascota+organizacion+profesional (doble solicitud idempotente).
create unique index vet_access_grants_one_pending
  on public.vet_access_grants (pet_id, org_id, vet_user_id) where status = 'pending';
-- Limite de solicitudes por mascota+organizacion en 24 h, y busqueda del grant vigente.
create index vet_access_grants_pet_org_idx
  on public.vet_access_grants (pet_id, org_id, created_at desc);
-- Bandeja del propietario.
create index vet_access_grants_owner_idx
  on public.vet_access_grants (owner_id, created_at desc);
-- "Mis accesos" de la veterinaria.
create index vet_access_grants_vet_idx
  on public.vet_access_grants (vet_user_id, status, expires_at);

-- ---------------------------------------------------------------------------
-- 2. vet_consultations: append-only. Sin UPDATE ni DELETE (ni grants ni RPC).
--    consulted_at lo fija el servidor (no se puede retrodatar desde el cliente).
--    client_request_id UNIQUE: idempotencia ante doble clic / reintento de red.
-- ---------------------------------------------------------------------------
create table public.vet_consultations (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  pet_id uuid not null references public.pets(id) on delete cascade,
  org_id uuid references public.organization_profiles(id) on delete set null,
  vet_user_id uuid references public.profiles(id) on delete set null,
  grant_id uuid references public.vet_access_grants(id) on delete set null,
  consulted_at timestamptz not null default now(),
  reason text not null check (char_length(reason) between 3 and 300),
  weight_kg numeric(6, 2) check (weight_kg > 0 and weight_kg <= 500),
  temperature_c numeric(4, 1) check (temperature_c between 25 and 45),
  heart_rate integer check (heart_rate between 10 and 400),
  respiratory_rate integer check (respiratory_rate between 2 and 200),
  symptoms text check (char_length(symptoms) <= 2000),
  physical_exam text check (char_length(physical_exam) <= 2000),
  diagnosis text check (char_length(diagnosis) <= 2000),
  treatment text check (char_length(treatment) <= 2000),
  recommendations text check (char_length(recommendations) <= 2000),
  final_observations text check (char_length(final_observations) <= 2000),
  urgency text not null default 'routine' check (urgency in ('routine', 'urgent', 'emergency')),
  follow_up_date date
);

comment on table public.vet_consultations is
  'Historia clinica de una mascota de usuario. Append-only (sin UPDATE/DELETE). Cada consulta conserva organizacion y profesional autores. Las correcciones son addenda.';

create index vet_consultations_pet_idx on public.vet_consultations (pet_id, consulted_at desc, id desc);

-- ---------------------------------------------------------------------------
-- 3. vet_consultation_medications: tabla hija estructurada (misma transaccion).
-- ---------------------------------------------------------------------------
create table public.vet_consultation_medications (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.vet_consultations(id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  name text not null check (char_length(name) between 1 and 100),
  dose numeric(10, 3) check (dose > 0),
  dose_unit text check (char_length(dose_unit) between 1 and 20),
  frequency text check (char_length(frequency) <= 80),
  route text check (route in ('oral', 'topical', 'intravenous', 'intramuscular', 'subcutaneous',
    'ophthalmic', 'otic', 'inhaled', 'rectal', 'other')),
  duration_days integer check (duration_days between 1 and 365),
  instructions text check (char_length(instructions) <= 500),
  start_date date,
  end_date date,
  notes text check (char_length(notes) <= 300),
  constraint vcm_dose_needs_unit check (dose is null or dose_unit is not null),
  constraint vcm_dates_order check (start_date is null or end_date is null or end_date >= start_date)
);

create index vet_consultation_medications_idx
  on public.vet_consultation_medications (consultation_id, position);

-- ---------------------------------------------------------------------------
-- 4. vet_consultation_addenda: correcciones/aclaraciones sin tocar el original.
-- ---------------------------------------------------------------------------
create table public.vet_consultation_addenda (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  consultation_id uuid not null references public.vet_consultations(id) on delete cascade,
  org_id uuid references public.organization_profiles(id) on delete set null,
  vet_user_id uuid references public.profiles(id) on delete set null,
  grant_id uuid references public.vet_access_grants(id) on delete set null,
  body text not null check (char_length(body) between 3 and 2000),
  created_at timestamptz not null default now()
);

create index vet_consultation_addenda_idx
  on public.vet_consultation_addenda (consultation_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. vet_access_audit: append-only. NO guarda contenido medico: solo quien, sobre
--    que mascota, cuando, por que metodo, con que grant y a que nivel.
--    Tambien es la base de los limites de frecuencia (rate limiting).
-- ---------------------------------------------------------------------------
create table public.vet_access_audit (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  action text not null check (action in (
    'IDENTIFY', 'IDENTIFY_FAILED', 'ACCESS_REQUEST', 'ACCESS_GRANTED', 'ACCESS_DENIED',
    'ACCESS_REVOKED', 'MEDICAL_VIEW', 'MEDICAL_CREATE', 'MEDICAL_ADDENDUM', 'MEDICAL_PDF',
    'EMERGENCY_ACCESS', 'EMERGENCY_FLAG_CHANGED')),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_org_id uuid references public.organization_profiles(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  grant_id uuid references public.vet_access_grants(id) on delete set null,
  method text check (method in ('qr', 'barcode', 'manual', 'nfc')),
  access_level text not null check (access_level in ('identification', 'emergency', 'medical', 'owner')),
  emergency_reason text check (char_length(emergency_reason) <= 300),
  code_hint text check (char_length(code_hint) <= 32)
);

comment on table public.vet_access_audit is
  'Bitacora append-only de identificacion, solicitudes, autorizaciones, consultas y emergencias. Sin datos medicos. Alimenta tambien el rate limiting.';

create index vet_access_audit_actor_idx on public.vet_access_audit (actor_id, action, at desc);
create index vet_access_audit_pet_idx on public.vet_access_audit (pet_id, at desc);
create index vet_access_audit_org_idx on public.vet_access_audit (actor_org_id, action, at desc);

-- ---------------------------------------------------------------------------
-- 6. Nivel 2 (emergencia): el propietario decide QUE items estan disponibles.
--    Cambio aditivo; por defecto nada se comparte.
-- ---------------------------------------------------------------------------
alter table public.pet_medical_items
  add column emergency_visible boolean not null default false;

-- ---------------------------------------------------------------------------
-- 7. Notificaciones: se reutiliza la tabla existente; solo se amplia el CHECK.
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'event_sighting', 'event_found', 'event_found_needs_help', 'event_org_received',
  'event_org_declined', 'org_approved', 'poster_approved', 'poster_rejected',
  'admin_new_org', 'admin_new_plate_order',
  'vet_access_requested', 'vet_access_decided', 'vet_access_revoked', 'vet_emergency_access'
]::text[]));

-- ---------------------------------------------------------------------------
-- 8. RLS y privilegios: por defecto Supabase concede ALL a anon/authenticated en
--    tablas nuevas; se revoca todo y se concede solo SELECT donde hay politica.
-- ---------------------------------------------------------------------------
alter table public.vet_access_grants enable row level security;
alter table public.vet_consultations enable row level security;
alter table public.vet_consultation_medications enable row level security;
alter table public.vet_consultation_addenda enable row level security;
alter table public.vet_access_audit enable row level security;

revoke all on public.vet_access_grants from anon, authenticated;
revoke all on public.vet_consultations from anon, authenticated;
revoke all on public.vet_consultation_medications from anon, authenticated;
revoke all on public.vet_consultation_addenda from anon, authenticated;
revoke all on public.vet_access_audit from anon, authenticated;

-- Grants: el propietario y el profesional solicitante ven SU fila; el admin lee todo
-- (no contienen datos medicos).
create policy "vag_read"
on public.vet_access_grants for select to authenticated
using (
  owner_id = (select auth.uid())
  or vet_user_id = (select auth.uid())
  or public.is_admin()
);
grant select on public.vet_access_grants to authenticated;

-- Historia clinica: SOLO el propietario de la mascota puede leerla por tabla.
-- Las veterinarias leen unicamente via RPC que exige grant vigente y permiso.
create policy "vc_owner_read"
on public.vet_consultations for select to authenticated
using (exists (
  select 1 from public.pets p where p.id = pet_id and p.owner_id = (select auth.uid())
));
grant select on public.vet_consultations to authenticated;

create policy "vcm_owner_read"
on public.vet_consultation_medications for select to authenticated
using (exists (
  select 1 from public.vet_consultations c
  join public.pets p on p.id = c.pet_id
  where c.id = consultation_id and p.owner_id = (select auth.uid())
));
grant select on public.vet_consultation_medications to authenticated;

create policy "vca_owner_read"
on public.vet_consultation_addenda for select to authenticated
using (exists (
  select 1 from public.vet_consultations c
  join public.pets p on p.id = c.pet_id
  where c.id = consultation_id and p.owner_id = (select auth.uid())
));
grant select on public.vet_consultation_addenda to authenticated;

-- Auditoria: lectura solo admin por tabla; el propietario la ve via RPC.
create policy "vaa_admin_read"
on public.vet_access_audit for select to authenticated
using (public.is_admin());
grant select on public.vet_access_audit to authenticated;
