import type { SupabaseClient } from "@supabase/supabase-js";
import { DATA_POLICY_TYPE, DATA_POLICY_VERSION } from "@/lib/legal/policy";

/**
 * Consentimiento de la Política de Tratamiento de Datos Personales. Es un
 * consentimiento OBLIGATORIO y separado de las 3 preferencias opcionales de
 * privacidad. La fuente de verdad es Supabase (`user_policy_consents`), nunca
 * localStorage. Los registros son inmutables (append-only).
 */

export interface PolicyConsent {
  policyType: string;
  policyVersion: string;
  acceptedAt: string;
}

/** Registra la aceptación de la versión vigente para el usuario autenticado. */
export async function recordPolicyConsent(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("record_policy_consent", {
    p_policy_type: DATA_POLICY_TYPE,
    p_policy_version: DATA_POLICY_VERSION,
  });
  if (error) throw error;
}

/** Historial de consentimientos del usuario autenticado. */
export async function fetchMyPolicyConsents(supabase: SupabaseClient): Promise<PolicyConsent[]> {
  const { data, error } = await supabase.rpc("my_policy_consents");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    policyType: String(row.policy_type),
    policyVersion: String(row.policy_version),
    acceptedAt: String(row.accepted_at),
  }));
}

/**
 * Devuelve la versión pendiente de aceptar (o `null` si el usuario ya aceptó la
 * vigente). Se usa para el aviso de re-consentimiento de cuentas existentes.
 */
export async function fetchPendingPolicyConsent(
  supabase: SupabaseClient,
): Promise<{ policyType: string; policyVersion: string } | null> {
  const { data, error } = await supabase.rpc("my_pending_policy_consent");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) return null;
  return { policyType: String(row.policy_type), policyVersion: String(row.policy_version) };
}
