import type { SupabaseClient } from "@supabase/supabase-js";
import { isAccountRole, roleAccessLabels, roleLabels, type AccountRole } from "./roles";

/**
 * Rol REAL asociado a un correo, leído desde Supabase (`profiles.role`, vía la
 * RPC `account_role_for_email`). Es la única fuente de verdad para decidir el
 * tipo de cuenta: el valor que elige el usuario en el formulario NO manda.
 *
 * Devuelve `null` si el correo no tiene cuenta.
 */
export async function fetchAccountRoleForEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<AccountRole | null> {
  const clean = email.trim();
  if (!clean) return null;
  const { data, error } = await supabase.rpc("account_role_for_email", { p_email: clean });
  if (error) throw error;
  return isAccountRole(data) ? data : null;
}

/** Mensaje profesional cuando el tipo elegido no coincide con el rol real. */
export function roleMismatchLoginMessage(realRole: AccountRole): string {
  return `Este correo ya está registrado como ${roleLabels[realRole]}. Ingresa desde el acceso de ${roleAccessLabels[realRole]}.`;
}

/**
 * Mensaje profesional cuando se intenta registrar un correo que ya existe con
 * otro rol. Indica también por dónde debe ingresar.
 */
export function accountExistsMessage(realRole: AccountRole): string {
  return `Este correo ya está registrado como ${roleLabels[realRole]}. Ingresa desde el acceso de ${roleAccessLabels[realRole]}.`;
}
