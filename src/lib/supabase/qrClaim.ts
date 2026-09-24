import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de `qr_claim_tag` (Bloque C): reclamo de una placa `available` por
 * su dueño real. Toda la validación real vive en la RPC (SECURITY DEFINER);
 * aquí solo se tipa la llamada y se traducen sus códigos de error a mensajes.
 */

export interface ClaimQrTagResult {
  shortCode: string;
}

const CLAIM_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Debes iniciar sesión para asignar este código.",
  PET_NOT_FOUND: "No encontramos esa mascota en tu cuenta.",
  PET_ARCHIVED: "Esa mascota está archivada y no se puede usar para esto.",
  TAG_NOT_FOUND: "Este código no existe.",
  TAG_ALREADY_ASSIGNED: "Este código ya fue asignado.",
  TAG_ALREADY_ACTIVE: "Este código ya fue asignado.",
  TAG_SUSPENDED: "Este código está suspendido y no se puede asignar.",
  TAG_REPLACED: "Este código fue reemplazado por uno nuevo y ya no se puede asignar.",
  TAG_ANNULLED: "Este código fue anulado y ya no se puede asignar.",
  TAG_NOT_AVAILABLE: "Este código ya no está disponible.",
  PET_ALREADY_HAS_TAG: "Esta mascota ya tiene otro código vinculado.",
};

/** Códigos que significan que la placa ya no sigue "available": conviene refrescar la página. */
export const CLAIM_TAG_STATE_CHANGED_CODES = new Set([
  "TAG_ALREADY_ASSIGNED",
  "TAG_ALREADY_ACTIVE",
  "TAG_SUSPENDED",
  "TAG_REPLACED",
  "TAG_ANNULLED",
  "TAG_NOT_AVAILABLE",
  "TAG_NOT_FOUND",
]);

function claimErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message).trim();
  }
  return null;
}

export function claimQrTagErrorMessage(error: unknown): string {
  const code = claimErrorCode(error);
  return (code && CLAIM_ERROR_MESSAGES[code]) || "No fue posible asignar este código. Intenta de nuevo.";
}

/** ¿El error indica que la placa cambió de estado mientras el usuario decidía? */
export function isClaimTagStateChanged(error: unknown): boolean {
  const code = claimErrorCode(error);
  return code !== null && CLAIM_TAG_STATE_CHANGED_CODES.has(code);
}

export async function claimQrTag(
  supabase: SupabaseClient,
  publicId: string,
  petId: string,
): Promise<ClaimQrTagResult> {
  const { data, error } = await supabase.rpc("qr_claim_tag", { p_public_id: publicId, p_pet_id: petId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return { shortCode: String(row.short_code) };
}
