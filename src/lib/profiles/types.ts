import type { AccountRole } from "@/lib/auth/roles";

/** Perfil de la cuenta autenticada (tabla `profiles`). */
export interface AccountProfile {
  id: string;
  role: AccountRole;
  displayName: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarPath: string | null;
}

/** Campos editables por la persona en su propio perfil. */
export interface AccountProfileInput {
  firstName: string;
  lastName: string;
  phone: string;
}
