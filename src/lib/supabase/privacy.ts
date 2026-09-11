import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Preferencias de privacidad del titular (Ley 1581 de 2012). Cada finalidad es
 * una autorización independiente y opt-in; la fuente de verdad es Supabase
 * (`user_privacy_preferences`), nunca localStorage. Toda escritura pasa por RPC
 * y queda registrada en la bitácora `user_privacy_preference_events`.
 */
export interface PrivacyPreferences {
  allowOrgContactAccess: boolean;
  allowPublicPhone: boolean;
  allowFoundPetContactSharing: boolean;
  updatedAt: string | null;
}

export async function fetchMyPrivacyPreferences(
  supabase: SupabaseClient,
): Promise<PrivacyPreferences> {
  const { data, error } = await supabase.rpc("my_privacy_preferences");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return {
    allowOrgContactAccess: Boolean(row?.allow_org_contact_access),
    allowPublicPhone: Boolean(row?.allow_public_phone),
    allowFoundPetContactSharing: Boolean(row?.allow_found_pet_contact_sharing),
    updatedAt: (row?.updated_at as string) ?? null,
  };
}

export async function saveMyPrivacyPreferences(
  supabase: SupabaseClient,
  prefs: PrivacyPreferences,
): Promise<void> {
  const { error } = await supabase.rpc("update_my_privacy_preferences", {
    p_allow_org_contact_access: prefs.allowOrgContactAccess,
    p_allow_public_phone: prefs.allowPublicPhone,
    p_allow_found_pet_contact_sharing: prefs.allowFoundPetContactSharing,
  });
  if (error) throw error;
}

/* ---------------- Eliminación de cuenta ---------------- */

export interface DeletionBlocker {
  code: string;
  message: string;
}

export async function accountDeletionPrecheck(
  supabase: SupabaseClient,
): Promise<{ canDelete: boolean; blockers: DeletionBlocker[] }> {
  const { data, error } = await supabase.rpc("account_deletion_precheck");
  if (error) throw error;
  const obj = (data ?? {}) as { can_delete?: boolean; blockers?: DeletionBlocker[] };
  return { canDelete: Boolean(obj.can_delete), blockers: obj.blockers ?? [] };
}

/**
 * Llama a la Edge Function `delete-account`. El servidor revalida los bloqueos,
 * exige la contraseña y la palabra "ELIMINAR", borra el usuario de Auth (libera
 * el correo, sin lista negra) y cascada a los datos dependientes.
 */
export async function requestAccountDeletion(
  supabase: SupabaseClient,
  input: { password: string; confirm: string },
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { password: input.password, confirm: input.confirm },
  });
  if (error) {
    // supabase-js envuelve el cuerpo de error de la función.
    let message = "No fue posible eliminar la cuenta.";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        message = body.message || body.error || message;
      }
    } catch {
      /* se usa el mensaje por defecto */
    }
    throw new Error(message);
  }
  if (data && (data as { ok?: boolean }).ok !== true) {
    throw new Error((data as { message?: string }).message ?? "No fue posible eliminar la cuenta.");
  }
}
