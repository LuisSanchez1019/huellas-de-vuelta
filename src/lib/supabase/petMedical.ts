import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sección "Información médica" de una mascota. Los límites de longitud se
 * repiten aquí (frontend) y en las RPC (`pet_medical_*`, servidor). El texto
 * médico privado nunca se publica: el perfil público solo recibe dos booleanos
 * (`medical_alert`, `medical_urgent`).
 */

export type MedicalPetKind = "owner" | "org";
export type MedicalItemKind = "condition" | "allergy" | "medication" | "urgent";
export type MedicalSource = "owner" | "vet" | "fundacion";

export const MEDICAL_LIMITS = {
  condition: { label: 150, detail: 0 },
  allergy: { label: 150, detail: 0 },
  medication: { label: 100, detail: 200 },
  urgent: { label: 150, detail: 250 },
  notes: 500,
} as const;

export const MEDICAL_SOURCE_LABEL: Record<MedicalSource, string> = {
  owner: "Aportada por el propietario",
  vet: "Registrada por la veterinaria",
  fundacion: "Registrada por la fundación",
};

export interface MedicalSummary {
  summaryId: string | null;
  hasCondition: boolean;
  hasAllergy: boolean;
  hasMedication: boolean;
  hasUrgent: boolean;
  notes: string | null;
  publicAlertEnabled: boolean;
  publicUrgentEnabled: boolean;
  updatedAt: string | null;
  callerSource: MedicalSource;
  canWrite: boolean;
}

export interface MedicalItem {
  id: string;
  kind: MedicalItemKind;
  label: string;
  detail: string | null;
  source: MedicalSource;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

export function medicalErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }
  return "No fue posible guardar la información médica.";
}

export async function fetchMedicalSummary(
  supabase: SupabaseClient,
  petKind: MedicalPetKind,
  petId: string,
): Promise<MedicalSummary> {
  const { data, error } = await supabase.rpc("pet_medical_get", {
    p_pet_kind: petKind,
    p_pet_id: petId,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null;
  if (!row) {
    return {
      summaryId: null,
      hasCondition: false,
      hasAllergy: false,
      hasMedication: false,
      hasUrgent: false,
      notes: null,
      publicAlertEnabled: false,
      publicUrgentEnabled: false,
      updatedAt: null,
      callerSource: "owner",
      canWrite: false,
    };
  }
  return {
    summaryId: (row.summary_id as string) ?? null,
    hasCondition: Boolean(row.has_condition),
    hasAllergy: Boolean(row.has_allergy),
    hasMedication: Boolean(row.has_medication),
    hasUrgent: Boolean(row.has_urgent),
    notes: (row.notes as string) ?? null,
    publicAlertEnabled: Boolean(row.public_alert_enabled),
    publicUrgentEnabled: Boolean(row.public_urgent_enabled),
    updatedAt: (row.updated_at as string) ?? null,
    callerSource: (row.caller_source as MedicalSource) ?? "owner",
    canWrite: Boolean(row.can_write),
  };
}

export async function fetchMedicalItems(
  supabase: SupabaseClient,
  petKind: MedicalPetKind,
  petId: string,
): Promise<MedicalItem[]> {
  const { data, error } = await supabase.rpc("pet_medical_items_list", {
    p_pet_kind: petKind,
    p_pet_id: petId,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    kind: row.kind as MedicalItemKind,
    label: String(row.label),
    detail: (row.detail as string) ?? null,
    source: row.source as MedicalSource,
    canEdit: Boolean(row.can_edit),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function saveMedicalSummary(
  supabase: SupabaseClient,
  petKind: MedicalPetKind,
  petId: string,
  input: {
    hasCondition: boolean;
    hasAllergy: boolean;
    hasMedication: boolean;
    hasUrgent: boolean;
    notes: string | null;
    publicAlert: boolean;
    publicUrgent: boolean;
  },
): Promise<void> {
  const { error } = await supabase.rpc("pet_medical_save_summary", {
    p_pet_kind: petKind,
    p_pet_id: petId,
    p_has_condition: input.hasCondition,
    p_has_allergy: input.hasAllergy,
    p_has_medication: input.hasMedication,
    p_has_urgent: input.hasUrgent,
    p_notes: input.notes,
    p_public_alert: input.publicAlert,
    p_public_urgent: input.publicUrgent,
  });
  if (error) throw error;
}

export async function addMedicalItem(
  supabase: SupabaseClient,
  petKind: MedicalPetKind,
  petId: string,
  kind: MedicalItemKind,
  label: string,
  detail?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("pet_medical_item_add", {
    p_pet_kind: petKind,
    p_pet_id: petId,
    p_kind: kind,
    p_label: label,
    p_detail: detail ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function updateMedicalItem(
  supabase: SupabaseClient,
  itemId: string,
  label: string,
  detail?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("pet_medical_item_update", {
    p_item_id: itemId,
    p_label: label,
    p_detail: detail ?? null,
  });
  if (error) throw error;
}

export async function deleteMedicalItem(supabase: SupabaseClient, itemId: string): Promise<void> {
  const { error } = await supabase.rpc("pet_medical_item_delete", { p_item_id: itemId });
  if (error) throw error;
}
