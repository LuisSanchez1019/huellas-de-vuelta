import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { resolvePanelSession, type PanelSession } from "./session";

export type AdminSessionCheck =
  | { status: "authorized"; session: PanelSession }
  | { status: "not-admin" }
  | { status: "unauthenticated" };

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

  // Sin sesión real (incluye el bypass de desarrollo) → no es admin.
  if (check.status !== "authenticated") {
    return check.status === "unauthenticated"
      ? { status: "unauthenticated" }
      : { status: "not-admin" };
  }

  const supabase = createSupabaseBrowserClient();
  try {
    const { data, error } = await supabase.rpc("is_admin");
    if (!error && data === true) {
      return { status: "authorized", session: check.session };
    }
  } catch {
    /* si falla la comprobación se trata como no-admin */
  }
  return { status: "not-admin" };
}
