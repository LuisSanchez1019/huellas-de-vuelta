import type { SupabaseClient } from "@supabase/supabase-js";
import { mapGrant, type GrantDuration, type VetGrant, type VetPermission } from "./access";
import { mapHistoryPage, type HistoryPage, type PdfAuthorization } from "./medical";

/**
 * Lado PROPIETARIO: bandeja de solicitudes, autorizar/rechazar, revocar,
 * auditoría, información de emergencia, historia clínica y PDF. Todo por RPC:
 * la BD comprueba `pets.owner_id = auth.uid()` en cada llamada.
 */

export interface OwnerGrant extends VetGrant {
  petId: string;
  petName: string;
  orgName: string;
  vetName: string;
}

export async function fetchOwnerAccess(supabase: SupabaseClient): Promise<OwnerGrant[]> {
  const { data, error } = await supabase.rpc("owner_list_access", { p_limit: 100 });
  if (error) throw error;
  return ((data as unknown as Record<string, unknown>[]) ?? []).map((raw) => ({
    ...mapGrant(raw),
    petId: String(raw.pet_id),
    petName: String(raw.pet_name),
    orgName: String(raw.org_name),
    vetName: String(raw.vet_name),
  }));
}

/**
 * Autoriza (con un subconjunto de lo solicitado y una duración de la lista) o
 * rechaza. Idempotente: un doble clic no vuelve a cambiar nada.
 */
export async function decideAccess(
  supabase: SupabaseClient,
  grantId: string,
  decision: { approve: true; permissions: VetPermission[]; duration: GrantDuration } | { approve: false },
): Promise<{ outcome: "decided" | "already_decided"; grant: VetGrant }> {
  const { data, error } = await supabase.rpc("owner_decide_access", {
    p_grant_id: grantId,
    p_decision: decision.approve ? "approve" : "deny",
    p_permissions: decision.approve ? decision.permissions : undefined,
    p_duration: decision.approve ? decision.duration : undefined,
  });
  if (error) throw error;
  const row = data as unknown as { outcome: "decided" | "already_decided"; grant: Record<string, unknown> };
  return { outcome: row.outcome, grant: mapGrant(row.grant) };
}

export async function revokeAccess(supabase: SupabaseClient, grantId: string): Promise<void> {
  const { error } = await supabase.rpc("owner_revoke_access", { p_grant_id: grantId });
  if (error) throw error;
}

export interface AuditEntry {
  at: string;
  action: string;
  method: string | null;
  accessLevel: "identification" | "emergency" | "medical" | "owner";
  orgName: string | null;
  vetName: string | null;
  emergencyReason: string | null;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  IDENTIFY: "Identificó a la mascota",
  ACCESS_REQUEST: "Solicitó acceso a la ficha",
  ACCESS_GRANTED: "Acceso autorizado",
  ACCESS_DENIED: "Solicitud rechazada",
  ACCESS_REVOKED: "Acceso revocado",
  MEDICAL_VIEW: "Consultó la ficha",
  MEDICAL_CREATE: "Registró una consulta",
  MEDICAL_ADDENDUM: "Añadió una aclaración",
  MEDICAL_PDF: "Generó un documento PDF",
  EMERGENCY_ACCESS: "Acceso de emergencia",
  EMERGENCY_FLAG_CHANGED: "Cambió qué se comparte en emergencias",
};

export async function fetchPetAccessAudit(supabase: SupabaseClient, petId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc("owner_pet_access_audit", { p_pet_id: petId, p_limit: 50 });
  if (error) throw error;
  return ((data as unknown as Record<string, unknown>[]) ?? []).map((a) => ({
    at: String(a.at),
    action: String(a.action),
    method: (a.method as string | null) ?? null,
    accessLevel: a.access_level as AuditEntry["accessLevel"],
    orgName: (a.org_name as string | null) ?? null,
    vetName: (a.vet_name as string | null) ?? null,
    emergencyReason: (a.emergency_reason as string | null) ?? null,
  }));
}

export interface EmergencyItem {
  id: string;
  kind: string;
  label: string;
  detail: string | null;
  emergencyVisible: boolean;
}

export async function fetchEmergencyItems(supabase: SupabaseClient, petId: string): Promise<EmergencyItem[]> {
  const { data, error } = await supabase.rpc("owner_list_emergency_items", { p_pet_id: petId });
  if (error) throw error;
  return ((data as unknown as Record<string, unknown>[]) ?? []).map((i) => ({
    id: String(i.id),
    kind: String(i.kind),
    label: String(i.label),
    detail: (i.detail as string | null) ?? null,
    emergencyVisible: Boolean(i.emergency_visible),
  }));
}

export async function setEmergencyVisible(supabase: SupabaseClient, itemId: string, visible: boolean): Promise<void> {
  const { error } = await supabase.rpc("owner_set_emergency_visible", { p_item_id: itemId, p_visible: visible });
  if (error) throw error;
}

export async function fetchOwnerHistoryPage(
  supabase: SupabaseClient,
  petId: string,
  options: { limit?: number; before?: string | null } = {},
): Promise<HistoryPage> {
  const { data, error } = await supabase.rpc("owner_medical_history", {
    p_pet_id: petId,
    p_limit: options.limit ?? 10,
    p_before: options.before ?? undefined,
  });
  if (error) throw error;
  return mapHistoryPage(data);
}

export async function authorizeOwnerPdf(supabase: SupabaseClient, petId: string): Promise<PdfAuthorization & { species: string; breed: string | null }> {
  const { data, error } = await supabase.rpc("owner_pdf_authorize", { p_pet_id: petId });
  if (error) throw error;
  const raw = data as unknown as Record<string, unknown>;
  return {
    petName: String(raw.pet_name),
    plateCode: (raw.plate_code as string | null) ?? null,
    orgName: null,
    vetName: null,
    ownerName: (raw.owner_name as string | null) ?? null,
    generatedAt: String(raw.generated_at),
    species: String(raw.species),
    breed: (raw.breed as string | null) ?? null,
  };
}
