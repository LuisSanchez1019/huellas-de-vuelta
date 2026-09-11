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
  phoneAlt: string;
  createdAt: string | null;
}

/** Campos editables por la persona en su propio perfil. */
export interface AccountProfileInput {
  firstName: string;
  lastName: string;
  phone: string;
  phoneAlt: string;
}
