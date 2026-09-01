import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { type AccountRole, isAccountRole, roleLabels } from "./roles";

export interface PanelSession {
  userId: string;
  email: string | null;
  displayName: string;
  role: AccountRole;
}

export type SessionCheck =
  | { status: "authenticated"; session: PanelSession; isDev: false }
  | { status: "dev"; session: PanelSession; isDev: true }
  | { status: "unauthenticated" };

// Bypass de solo-desarrollo. `process.env.NODE_ENV` lo reemplaza Next.js en
// tiempo de compilación: en cualquier build de producción esto es "production".
const DEV_BYPASS_ENABLED = process.env.NODE_ENV !== "production";
const DEV_ROLE_KEY = "hdv.dev.role";

/** Rol simulado para previsualizar cada panel sin iniciar sesión (solo dev). */
export function getDevRole(): AccountRole {
  if (typeof window === "undefined") return "usuario";
  try {
    const raw = window.localStorage.getItem(DEV_ROLE_KEY);
    return isAccountRole(raw) ? raw : "usuario";
  } catch {
    return "usuario";
  }
}

export function setDevRole(role: AccountRole): void {
  try {
    window.localStorage.setItem(DEV_ROLE_KEY, role);
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

/**
 * Id del usuario autenticado en Supabase, o `null` si no hay sesión real.
 * Los repositorios lo usan para decidir entre Supabase y el respaldo local.
 */
export async function getSupabaseUserId(): Promise<string | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

function displayNameFrom(metadataName: unknown, email: string | null): string {
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  return email || "Tu cuenta";
}

/**
 * Única fuente de verdad de "quién está autenticado y con qué rol".
 * Prioridad del rol: profiles.role (BD) → user_metadata.role → "usuario".
 */
export async function resolvePanelSession(): Promise<SessionCheck> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (session) {
    const user = session.user;
    let role: AccountRole = isAccountRole(user.user_metadata?.role)
      ? (user.user_metadata.role as AccountRole)
      : "usuario";
    let displayName = displayNameFrom(user.user_metadata?.display_name, user.email ?? null);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        if (isAccountRole(profile.role)) role = profile.role;
        if (typeof profile.display_name === "string" && profile.display_name.trim()) {
          displayName = profile.display_name.trim();
        }
      }
    } catch {
      /* si falla la lectura del perfil, se usa el rol del metadata */
    }

    return {
      status: "authenticated",
      isDev: false,
      session: { userId: user.id, email: user.email ?? null, displayName, role },
    };
  }

  if (DEV_BYPASS_ENABLED) {
    const role = getDevRole();
    return {
      status: "dev",
      isDev: true,
      session: {
        userId: `dev-${role}`,
        email: null,
        displayName: `Modo desarrollo (${roleLabels[role]})`,
        role,
      },
    };
  }

  return { status: "unauthenticated" };
}
