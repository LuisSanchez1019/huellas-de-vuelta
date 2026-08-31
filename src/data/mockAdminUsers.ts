export type AdminUserStatus = "active" | "suspended";

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  registeredAt: string; // ISO date
  status: AdminUserStatus;
  petsCount: number;
  location: string;
}

// Datos de ejemplo mientras se conecta este módulo a Supabase.
export const mockAdminUsers: AdminUserSummary[] = [
  { id: "u1", name: "Camila Rojas", email: "camila.rojas@example.com", registeredAt: "2026-08-12", status: "active", petsCount: 2, location: "Bucaramanga" },
  { id: "u2", name: "Andrés Pardo", email: "andres.pardo@example.com", registeredAt: "2026-08-20", status: "active", petsCount: 1, location: "Girón" },
  { id: "u3", name: "Laura Gómez", email: "laura.gomez@example.com", registeredAt: "2026-07-30", status: "suspended", petsCount: 0, location: "Floridablanca" },
  { id: "u4", name: "Julián Ortiz", email: "julian.ortiz@example.com", registeredAt: "2026-08-25", status: "active", petsCount: 3, location: "Piedecuesta" },
  { id: "u5", name: "Valentina Ruiz", email: "valentina.ruiz@example.com", registeredAt: "2026-08-05", status: "active", petsCount: 1, location: "Bucaramanga" },
];
