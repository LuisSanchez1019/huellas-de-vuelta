import type { SupabaseClient } from "@supabase/supabase-js";
import type { QrTagStatus } from "./qr";

/**
 * Cliente de las RPC del PROVEEDOR para sus propios lotes/placas QR
 * (`qr_provider_*`, SECURITY DEFINER, exigen `role = 'proveedor'` en el
 * servidor). Un proveedor solo puede GENERAR placas en `available`; nunca
 * asignar, activar, suspender, reemplazar ni anular — eso sigue siendo
 * exclusivo de admin (`qr_admin_*`, sin tocar).
 */

export const PROVIDER_QR_QUANTITIES = [1, 5, 10, 20] as const;
export type ProviderQrQuantity = (typeof PROVIDER_QR_QUANTITIES)[number];

export interface ProviderQrBatch {
  id: string;
  reference: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  total: number;
  available: number;
  assigned: number;
  active: number;
  suspended: number;
  replaced: number;
  annulled: number;
}

export interface ProviderQrTag {
  id: string;
  publicId: string;
  shortCode: string;
  status: QrTagStatus;
  batchId: string;
  batchReference: string;
  createdAt: string;
  updatedAt: string;
}

const PROVIDER_QR_ERROR_MESSAGES: Record<string, string> = {
  "No autorizado.": "No tienes permiso para esta operación.",
};

export function providerQrErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const raw = String((error as { message: string }).message);
    return PROVIDER_QR_ERROR_MESSAGES[raw] ?? raw;
  }
  return "No fue posible completar la operación.";
}

export async function createProviderQrBatch(
  supabase: SupabaseClient,
  input: { quantity: ProviderQrQuantity; note?: string | null },
): Promise<{ batchId: string; quantity: number; prefix: string; firstCode: string; lastCode: string }> {
  const { data, error } = await supabase.rpc("qr_provider_batch_create", {
    p_quantity: input.quantity,
    p_note: input.note ?? null,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return {
    batchId: String(row.batch_id),
    quantity: Number(row.quantity),
    prefix: String(row.code_prefix),
    firstCode: String(row.first_code),
    lastCode: String(row.last_code),
  };
}

export async function listProviderQrBatches(supabase: SupabaseClient): Promise<ProviderQrBatch[]> {
  const { data, error } = await supabase.rpc("qr_provider_list_batches");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    reference: String(row.reference),
    quantity: Number(row.quantity),
    note: (row.note as string) ?? null,
    createdAt: String(row.created_at),
    total: Number(row.total),
    available: Number(row.available),
    assigned: Number(row.assigned),
    active: Number(row.active),
    suspended: Number(row.suspended),
    replaced: Number(row.replaced),
    annulled: Number(row.annulled),
  }));
}

export async function listProviderQrTags(
  supabase: SupabaseClient,
  opts: { batchId?: string | null; status?: QrTagStatus | null; limit?: number; offset?: number } = {},
): Promise<{ rows: ProviderQrTag[]; total: number }> {
  const { data, error } = await supabase.rpc("qr_provider_list_tags", {
    p_batch_id: opts.batchId ?? null,
    p_status: opts.status ?? null,
    p_limit: opts.limit ?? 50,
    p_offset: opts.offset ?? 0,
  });
  if (error) throw error;
  const list = (data ?? []) as Record<string, unknown>[];
  return {
    total: list.length > 0 ? Number(list[0].total_count) : 0,
    rows: list.map((row) => ({
      id: String(row.id),
      publicId: String(row.public_id),
      shortCode: String(row.short_code),
      status: row.status as QrTagStatus,
      batchId: String(row.batch_id),
      batchReference: String(row.batch_reference),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
  };
}
