import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdentificationMethod } from "./identification";

/**
 * Servicio de AUTORIZACIÓN (lado veterinaria). Toda decisión real vive en la BD
 * (`vet_*` SECURITY DEFINER, con `auth.uid()`); aquí solo se tipa y se mapea.
 * El cliente NUNCA envía propietario, organización, profesional ni fecha de
 * vencimiento: solo la mascota (por el public_id de su placa), los permisos
 * pedidos y una duración de una lista cerrada.
 */

export type VetPermission =
  | "can_read_medical"
  | "can_create_consultation"
  | "can_add_diagnosis"
  | "can_add_treatment"
  | "can_generate_pdf";

export const VET_PERMISSIONS: readonly VetPermission[] = [
  "can_read_medical",
  "can_create_consultation",
  "can_add_diagnosis",
  "can_add_treatment",
  "can_generate_pdf",
];

export const PERMISSION_LABELS: Record<VetPermission, string> = {
  can_read_medical: "Consultar historia",
  can_create_consultation: "Registrar consulta",
  can_add_diagnosis: "Registrar diagnóstico",
  can_add_treatment: "Registrar tratamiento",
  can_generate_pdf: "Generar documento médico",
};

export type GrantDuration = "30m" | "1h" | "24h";
export const GRANT_DURATIONS: readonly GrantDuration[] = ["30m", "1h", "24h"];
export const DURATION_LABELS: Record<GrantDuration, string> = {
  "30m": "30 minutos",
  "1h": "1 hora",
  "24h": "24 horas",
};

export type EffectiveGrantStatus = "pending" | "active" | "expired" | "revoked" | "denied";

export const GRANT_STATUS_LABELS: Record<EffectiveGrantStatus, string> = {
  pending: "Pendiente",
  active: "Activo",
  expired: "Vencido",
  revoked: "Revocado",
  denied: "Rechazado",
};

export interface VetGrant {
  id: string;
  status: "pending" | "active" | "revoked" | "denied";
  /** "expired" se DERIVA en la BD de expires_at; nunca se guarda. */
  effectiveStatus: EffectiveGrantStatus;
  requestedPermissions: VetPermission[];
  grantedPermissions: VetPermission[];
  requestedDuration: GrantDuration;
  grantedDuration: GrantDuration | null;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  petName?: string;
}

export function mapGrant(raw: Record<string, unknown>): VetGrant {
  return {
    id: String(raw.id),
    status: raw.status as VetGrant["status"],
    effectiveStatus: raw.effective_status as EffectiveGrantStatus,
    requestedPermissions: (raw.requested_permissions as VetPermission[]) ?? [],
    grantedPermissions: (raw.granted_permissions as VetPermission[]) ?? [],
    requestedDuration: raw.requested_duration as GrantDuration,
    grantedDuration: (raw.granted_duration as GrantDuration | null) ?? null,
    reason: (raw.reason as string | null) ?? null,
    createdAt: String(raw.created_at),
    decidedAt: (raw.decided_at as string | null) ?? null,
    expiresAt: (raw.expires_at as string | null) ?? null,
    revokedAt: (raw.revoked_at as string | null) ?? null,
    petName: raw.pet_name ? String(raw.pet_name) : undefined,
  };
}

export type RequestAccessOutcome = "created" | "already_pending" | "already_active";

export interface RequestAccessResult {
  outcome: RequestAccessOutcome;
  grant: VetGrant;
}

export async function requestAccess(
  supabase: SupabaseClient,
  input: {
    tagPublicId: string;
    permissions: VetPermission[];
    duration: GrantDuration;
    reason: string | null;
    method: IdentificationMethod;
  },
): Promise<RequestAccessResult> {
  const { data, error } = await supabase.rpc("vet_request_access", {
    p_tag_public_id: input.tagPublicId,
    p_permissions: input.permissions,
    p_duration: input.duration,
    p_reason: input.reason,
    p_method: input.method,
  });
  if (error) throw error;
  const row = data as unknown as { outcome: RequestAccessOutcome; grant: Record<string, unknown> };
  return { outcome: row.outcome, grant: mapGrant(row.grant) };
}

/** Estado vigente de UN grant propio (sondeo para detectar autorización/revocación/vencimiento). */
export async function getGrant(supabase: SupabaseClient, grantId: string): Promise<VetGrant> {
  const { data, error } = await supabase.rpc("vet_get_grant", { p_grant_id: grantId });
  if (error) throw error;
  return mapGrant(data as unknown as Record<string, unknown>);
}

/** Mis accesos: pendientes, vigentes y cerrados en las últimas 24 h. */
export async function fetchMyGrants(supabase: SupabaseClient): Promise<VetGrant[]> {
  const { data, error } = await supabase.rpc("vet_my_grants");
  if (error) throw error;
  return ((data as unknown as Record<string, unknown>[]) ?? []).map(mapGrant);
}
