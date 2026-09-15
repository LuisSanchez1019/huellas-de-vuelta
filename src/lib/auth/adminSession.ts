import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { withTimeout } from "@/lib/async/withTimeout";
import { resolvePanelSession, type PanelSession } from "./session";

export type AdminSessionCheck =
  | { status: "authorized"; session: PanelSession }
  | { status: "not-admin" }
  | { status: "unauthenticated" }
  | { status: "error" };

const IS_ADMIN_TIMEOUT_MS = 8_000;

/**
 * ¿La sesión actual puede entrar al área de administración?
 *
 * El acceso depende EXCLUSIVAMENTE de `profiles.is_admin` (comprobado por el RPC
 * `is_admin()`, que además protege la BD). No hay atajo por email ni por el modo
 * desarrollo: sin una sesión real cuyo perfil tenga `is_admin = true`, el acceso
 * se deniega. Aun si alguien saltara esta comprobación, Supabase (RLS + funciones
 * SECURITY DEFINER) rechaza cualquier lectura o acción administrativa.
 */
export async function resolveAdminSession(): Promise<AdminSessionCheck> {
  const check = await resolvePanelSession();

  if (check.status === "error") return { status: "error" };
  // Sin sesión real (incluye el bypass de desarrollo) → no es admin.
  if (check.status !== "authenticated") {
    return check.status === "unauthenticated"
      ? { status: "unauthenticated" }
      : { status: "not-admin" };
  }

  const supabase = createSupabaseBrowserClient();
  try {
    const { data, error } = await withTimeout(supabase.rpc("is_admin"), IS_ADMIN_TIMEOUT_MS);
    if (!error && data === true) {
      return { status: "authorized", session: check.session };
    }
    if (error) return { status: "error" };
  } catch {
    return { status: "error" };
  }
  return { status: "not-admin" };
}
