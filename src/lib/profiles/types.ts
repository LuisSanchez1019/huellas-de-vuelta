import type { AccountRole } from "@/lib/auth/roles";

/** Perfil de la cuenta autenticada (tabla `profiles` + `auth.users`). */
export interface AccountProfile {
  id: string;
  role: AccountRole;
  isAdmin: boolean;
  email: string | null;
  emailConfirmed: boolean;
  displayName: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarPath: string | null;
  createdAt: string | null;
}

/** Campos editables por la persona en su propio perfil. */
export interface AccountProfileInput {
  firstName: string;
  lastName: string;
  phone: string;
  /** Ruta del avatar en Storage; `null` si se quita, `undefined` si no cambia. */
  avatarPath?: string | null;
}
