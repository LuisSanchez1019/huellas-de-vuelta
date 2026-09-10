export type AccountRole = "usuario" | "fundacion" | "veterinaria" | "aliado";

/** Todos los roles de cuenta. */
export const ACCOUNT_ROLES: AccountRole[] = ["usuario", "veterinaria", "fundacion", "aliado"];

/** Roles que se registran/inician desde el acceso VET/FUN (una sola puerta, dos tipos). */
export const ORG_ROLES: AccountRole[] = ["veterinaria", "fundacion"];

export const roleLabels: Record<AccountRole, string> = {
  usuario: "Usuario",
  fundacion: "Fundación",
  veterinaria: "Veterinaria",
  aliado: "Aliado",
};

/**
 * Nombre del acceso (portal) al que corresponde cada rol. Se usa en los
 * mensajes de incompatibilidad para indicar por dónde debe ingresar la persona.
 */
export const roleAccessLabels: Record<AccountRole, string> = {
  usuario: "Usuarios",
  fundacion: "Fundación",
  veterinaria: "Veterinaria",
  aliado: "Aliados",
};

/** Ruta del portal de autenticación que corresponde a cada rol. */
export const roleAuthPortal: Record<AccountRole, string> = {
  usuario: "/auth/usuarios",
  fundacion: "/auth/fundacion",
  veterinaria: "/auth/veterinaria",
  aliado: "/auth/aliado",
};

/** Panel de inicio de cada rol. Un solo lugar donde se define el ruteo por rol. */
export const roleHome: Record<AccountRole, string> = {
  usuario: "/dashboard",
  fundacion: "/fundacion",
  veterinaria: "/veterinaria",
  aliado: "/aliado",
};

export function isAccountRole(value: unknown): value is AccountRole {
  return (
    value === "usuario" ||
    value === "fundacion" ||
    value === "veterinaria" ||
    value === "aliado"
  );
}
