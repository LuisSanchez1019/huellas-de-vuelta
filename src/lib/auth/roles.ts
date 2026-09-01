export type AccountRole = "usuario" | "fundacion" | "veterinaria";

export const ACCOUNT_ROLES: AccountRole[] = ["usuario", "fundacion", "veterinaria"];

export const roleLabels: Record<AccountRole, string> = {
  usuario: "Usuario",
  fundacion: "Fundación",
  veterinaria: "Veterinaria",
};

/** Panel de inicio de cada rol. Un solo lugar donde se define el ruteo por rol. */
export const roleHome: Record<AccountRole, string> = {
  usuario: "/dashboard",
  fundacion: "/fundacion",
  veterinaria: "/veterinaria",
};

export function isAccountRole(value: unknown): value is AccountRole {
  return value === "usuario" || value === "fundacion" || value === "veterinaria";
}
