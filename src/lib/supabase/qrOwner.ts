import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Acciones del PROPIETARIO sobre la placa de su mascota. Toda la validación real vive en la RPC
 * `qr_owner_set_pet_tag_state` (SECURITY DEFINER): identifica al usuario con auth.uid(), comprueba que
 * la mascota sea suya y solo permite suspender una placa activa o reactivar una suspensión propia
 * (la suspensión hecha por un administrador no se revierte desde aquí).
 */

export type OwnerTagAction = "suspend" | "resume";

const OWNER_TAG_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: "Inicia sesión para continuar.",
  ROLE_NOT_ALLOWED: "Esta acción es solo para cuentas de usuario.",
  PET_NOT_FOUND: "No encontramos esa mascota en tu cuenta.",
  TAG_NOT_FOUND: "Esta mascota no tiene una placa vigente.",
  TAG_NOT_ACTIVE: "La placa no está activa.",
  TAG_NOT_SUSPENDED: "La placa no está suspendida.",
  TAG_SUSPENDED_BY_ADMIN: "El equipo de Huellas de Vuelta suspendió esta placa. Contáctanos para reactivarla.",
  INVALID_ACTION: "Acción no válida.",
};

export function ownerTagErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const code = String((error as { message: string }).message).trim();
    return OWNER_TAG_ERRORS[code] ?? "No fue posible actualizar la placa. Intenta de nuevo.";
  }
  return "No fue posible actualizar la placa. Intenta de nuevo.";
}

export async function setPetTagState(
  supabase: SupabaseClient,
  petId: string,
  action: OwnerTagAction,
  reason?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("qr_owner_set_pet_tag_state", {
    p_pet_id: petId,
    p_action: action,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}
