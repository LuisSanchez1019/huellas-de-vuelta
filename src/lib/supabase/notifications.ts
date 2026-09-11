import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "notifications";

export type NotificationType =
  | "event_sighting"
  | "event_found"
  | "event_found_needs_help"
  | "event_org_received"
  | "event_org_declined"
  | "org_approved"
  | "poster_approved"
  | "poster_rejected"
  | "admin_new_org"
  | "admin_new_plate_order";

/** Ruta a la que enlaza cada tipo de notificación (o `null` si no aplica). */
export function notificationLink(type: NotificationType): string | null {
  switch (type) {
    case "admin_new_org":
      return "/admin/organizaciones";
    case "admin_new_plate_order":
      return "/admin/pedidos";
    case "poster_approved":
    case "poster_rejected":
    case "org_approved":
      return null;
    default:
      return "/dashboard/reportes/activos";
  }
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  report_id: string | null;
  event_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export async function fetchNotifications(
  supabase: SupabaseClient,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<AppNotification[]> {
  let query = supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.unreadOnly) query = query.is("read_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function countUnreadNotifications(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}

export async function deleteNotification(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/** Borra varias notificaciones del usuario en una sola llamada. */
export async function deleteNotifications(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from(TABLE).delete().in("id", ids);
  if (error) throw error;
}
