import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountRole } from "@/lib/auth/roles";

/** Fila que devuelve `admin_list_users()` (solo admin). */
export interface AdminUser {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: AccountRole;
  isAdmin: boolean;
  confirmedAt: string | null;
  petsCount: number;
  createdAt: string;
}

export async function adminListUsers(supabase: SupabaseClient): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    displayName: (row.display_name as string) ?? null,
    firstName: (row.first_name as string) ?? null,
    lastName: (row.last_name as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    role: (row.role as AccountRole) ?? "usuario",
    isAdmin: Boolean(row.is_admin),
    confirmedAt: (row.confirmed_at as string) ?? null,
    petsCount: Number(row.pets_count ?? 0),
    createdAt: String(row.created_at ?? ""),
  }));
}

/**
 * Convierte a un usuario existente en administrador, o le quita el rol.
 * Ejecuta el RPC `set_user_admin` (SECURITY DEFINER): valida que quien llama sea
 * admin y protege al último administrador del sistema.
 */
export async function setUserAdmin(
  supabase: SupabaseClient,
  userId: string,
  makeAdmin: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_user_admin", {
    p_user_id: userId,
    p_make_admin: makeAdmin,
  });
  if (error) throw error;
}

export interface AdminCounts {
  users: number;
  pets: number;
  activeReports: number;
  pendingOrgs: number;
}

export async function adminCounts(supabase: SupabaseClient): Promise<AdminCounts> {
  const { data, error } = await supabase.rpc("admin_counts");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return {
    users: Number(row?.users ?? 0),
    pets: Number(row?.pets ?? 0),
    activeReports: Number(row?.active_reports ?? 0),
    pendingOrgs: Number(row?.pending_orgs ?? 0),
  };
}
