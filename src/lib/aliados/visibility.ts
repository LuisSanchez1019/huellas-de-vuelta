import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_ALLIES_TAG, triggerPublicRevalidate } from "@/lib/cache/tags";

/**
 * Visibilidad paga de aliados: días × tarifa diaria vigente (sin paquetes
 * fijos). El total SIEMPRE se recalcula en el servidor (RPC `aliado_visibility_quote`
 * / `aliado_visibility_request_create`); el cálculo del navegador es solo para
 * mostrarlo al instante mientras el aliado ajusta los días.
 *
 * NO existe pasarela de pagos: crear una solicitud la deja "pending". Un
 * administrador la confirma manualmente (mismo mecanismo que los pedidos de
 * placa). Nada de esto hace público al aliado por sí solo.
 */

export interface AliadoVisibilitySettings {
  dailyRate: number;
  minDays: number;
  maxDays: number;
}

export interface AliadoVisibilityQuote {
  days: number;
  dailyRate: number;
  totalAmount: number;
}

export type AliadoVisibilityStatus = "pending" | "vigente" | "vencido" | "rejected" | "cancelled";

export interface AliadoVisibilityOrder {
  id: string;
  days: number;
  dailyRateApplied: number;
  totalAmount: number;
  paymentStatus: "pending" | "approved" | "rejected" | "cancelled";
  paymentReference: string | null;
  startDate: string | null;
  endDate: string | null;
  requestedAt: string;
  computedStatus: AliadoVisibilityStatus;
}

export interface AdminAliadoVisibilityOrder extends AliadoVisibilityOrder {
  orgId: string;
  orgName: string;
  ownerEmail: string | null;
}

export async function fetchAliadoVisibilitySettings(
  supabase: SupabaseClient,
): Promise<AliadoVisibilitySettings> {
  const { data, error } = await supabase.rpc("aliado_visibility_settings_current");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) throw new Error("No hay configuración de visibilidad disponible.");
  return {
    dailyRate: Number(row.daily_rate),
    minDays: Number(row.min_days),
    maxDays: Number(row.max_days),
  };
}

/** Cotización server-side: nunca confiar solo en el cálculo del navegador. */
export async function quoteAliadoVisibility(
  supabase: SupabaseClient,
  days: number,
): Promise<AliadoVisibilityQuote> {
  const { data, error } = await supabase.rpc("aliado_visibility_quote", { p_days: days });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return {
    days: Number(row.days),
    dailyRate: Number(row.daily_rate),
    totalAmount: Number(row.total_amount),
  };
}

/** Crea la solicitud (queda "pending"). No activa nada públicamente. */
export async function createAliadoVisibilityRequest(
  supabase: SupabaseClient,
  days: number,
): Promise<string> {
  const { data, error } = await supabase.rpc("aliado_visibility_request_create", { p_days: days });
  if (error) throw error;
  return String(data);
}

function rowToOrder(row: Record<string, unknown>): AliadoVisibilityOrder {
  return {
    id: String(row.id),
    days: Number(row.days),
    dailyRateApplied: Number(row.daily_rate_applied),
    totalAmount: Number(row.total_amount),
    paymentStatus: row.payment_status as AliadoVisibilityOrder["paymentStatus"],
    paymentReference: (row.payment_reference as string) ?? null,
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    requestedAt: String(row.requested_at),
    computedStatus: row.computed_status as AliadoVisibilityStatus,
  };
}

export async function fetchMyAliadoVisibilityOrders(
  supabase: SupabaseClient,
): Promise<AliadoVisibilityOrder[]> {
  const { data, error } = await supabase.rpc("my_aliado_visibility_orders");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToOrder);
}

export async function adminFetchAliadoVisibilityOrders(
  supabase: SupabaseClient,
): Promise<AdminAliadoVisibilityOrder[]> {
  const { data, error } = await supabase.rpc("admin_list_aliado_visibility_orders");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...rowToOrder(row),
    orgId: String(row.org_id),
    orgName: String(row.org_name ?? ""),
    ownerEmail: (row.owner_email as string) ?? null,
  }));
}

export async function adminSetAliadoVisibilityPayment(
  supabase: SupabaseClient,
  orderId: string,
  status: "approved" | "rejected" | "cancelled",
  reference?: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_set_aliado_visibility_payment", {
    p_order_id: orderId,
    p_status: status,
    p_reference: reference ?? null,
  });
  if (error) throw error;
  // El estado público (quién aparece como aliado vigente) puede haber cambiado.
  if (status === "approved") triggerPublicRevalidate(PUBLIC_ALLIES_TAG);
}

export async function adminSetAliadoVisibilitySettings(
  supabase: SupabaseClient,
  settings: AliadoVisibilitySettings,
): Promise<void> {
  const { error } = await supabase.rpc("admin_set_aliado_visibility_settings", {
    p_daily_rate: settings.dailyRate,
    p_min_days: settings.minDays,
    p_max_days: settings.maxDays,
  });
  if (error) throw error;
}

export interface PublicActiveAlly {
  id: string;
  name: string;
  logoUrl: string | null;
  logoPath: string | null;
  city: string | null;
  country: string | null;
  endDate: string;
}

export async function fetchPublicActiveAllies(supabase: SupabaseClient): Promise<PublicActiveAlly[]> {
  const { data, error } = await supabase.rpc("list_public_active_allies");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    logoUrl: (row.logo_url as string) ?? null,
    logoPath: (row.logo_path as string) ?? null,
    city: (row.city as string) ?? null,
    country: (row.country as string) ?? null,
    endDate: String(row.end_date),
  }));
}
