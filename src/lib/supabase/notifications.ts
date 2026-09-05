import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "notifications";

export type NotificationType =
  | "event_sighting"
  | "event_found"
  | "event_found_needs_help"
  | "event_org_received"
  | "event_org_declined"
  | "org_approved";

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
