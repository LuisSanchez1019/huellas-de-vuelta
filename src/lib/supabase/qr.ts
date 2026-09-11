import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de las RPC de administración de placas QR. Toda la lógica vive en
 * funciones `SECURITY DEFINER` con `is_admin()`; aquí solo se tipa la llamada.
 */

export type QrTagStatus =
  | "available"
  | "assigned"
  | "active"
  | "suspended"
  | "replaced"
  | "annulled";

export type QrPetKind = "owner" | "org";

export const QR_STATUS_LABEL: Record<QrTagStatus, string> = {
  available: "Disponible",
  assigned: "Asignada",
  active: "Activa",
  suspended: "Suspendida",
  replaced: "Reemplazada",
  annulled: "Anulada",
};

export interface QrBatch {
  id: string;
  reference: string;
  quantity: number;
  note: string | null;
  isSystem: boolean;
  createdAt: string;
  total: number;
  available: number;
  assigned: number;
  active: number;
  suspended: number;
  replaced: number;
  annulled: number;
}

export interface QrTag {
  id: string;
  publicId: string;
  shortCode: string;
  status: QrTagStatus;
  batchId: string;
  batchReference: string;
  petKind: QrPetKind | null;
  petId: string | null;
  petName: string | null;
  assignedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface QrTagDetail extends QrTag {
  notes: string | null;
  petExtra: string | null;
  petOwnerLabel: string | null;
  replacedByTagId: string | null;
  replacedByCode: string | null;
}

export interface QrTagEvent {
  id: string;
  event: string;
  reason: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export interface QrPetSearchResult {
  petKind: QrPetKind;
  petId: string;
  name: string;
  extra: string | null;
  ownerLabel: string | null;
  hasLiveTag: boolean;
  liveTagCode: string | null;
}

export interface QrExportRow {
  shortCode: string;
  publicId: string;
  status: QrTagStatus;
}

const QR_ERROR_MESSAGES: Record<string, string> = {
  "No autorizado.": "No tienes permiso para esta operación.",
};

export function qrErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const raw = String((error as { message: string }).message);
    return QR_ERROR_MESSAGES[raw] ?? raw;
  }
  return "No fue posible completar la operación.";
}

export async function createQrBatch(
  supabase: SupabaseClient,
  input: { reference: string; quantity: number; note?: string | null },
): Promise<{ batchId: string; quantity: number; firstCode: string; lastCode: string }> {
  const { data, error } = await supabase.rpc("qr_batch_create", {
    p_reference: input.reference,
    p_quantity: input.quantity,
    p_note: input.note ?? null,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return {
    batchId: String(row.batch_id),
    quantity: Number(row.quantity),
    firstCode: String(row.first_code),
    lastCode: String(row.last_code),
  };
}

export async function listQrBatches(supabase: SupabaseClient): Promise<QrBatch[]> {
  const { data, error } = await supabase.rpc("qr_admin_list_batches");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    reference: String(row.reference),
    quantity: Number(row.quantity),
    note: (row.note as string) ?? null,
    isSystem: Boolean(row.is_system),
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

export async function listQrTags(
  supabase: SupabaseClient,
  opts: {
    batchId?: string | null;
    status?: QrTagStatus | null;
    query?: string | null;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ rows: QrTag[]; total: number }> {
  const { data, error } = await supabase.rpc("qr_admin_list_tags", {
    p_batch_id: opts.batchId ?? null,
    p_status: opts.status ?? null,
    p_query: opts.query ?? null,
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
      petKind: (row.pet_kind as QrPetKind) ?? null,
      petId: (row.pet_id as string) ?? null,
      petName: (row.pet_name as string) ?? null,
      assignedAt: (row.assigned_at as string) ?? null,
      updatedAt: String(row.updated_at),
      createdAt: String(row.created_at),
    })),
  };
}

export async function qrTagDetail(
  supabase: SupabaseClient,
  tagId: string,
): Promise<QrTagDetail | null> {
  const { data, error } = await supabase.rpc("qr_admin_tag_detail", { p_tag_id: tagId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null;
  if (!row) return null;
  return {
    id: String(row.id),
    publicId: String(row.public_id),
    shortCode: String(row.short_code),
    status: row.status as QrTagStatus,
    notes: (row.notes as string) ?? null,
    batchId: String(row.batch_id),
    batchReference: String(row.batch_reference),
    petKind: (row.pet_kind as QrPetKind) ?? null,
    petId: (row.pet_id as string) ?? null,
    petName: (row.pet_name as string) ?? null,
    petExtra: (row.pet_extra as string) ?? null,
    petOwnerLabel: (row.pet_owner_label as string) ?? null,
    replacedByTagId: (row.replaced_by_tag_id as string) ?? null,
    replacedByCode: (row.replaced_by_code as string) ?? null,
    assignedAt: (row.assigned_at as string) ?? null,
    updatedAt: String(row.updated_at),
    createdAt: String(row.created_at),
  };
}

export async function qrTagEvents(
  supabase: SupabaseClient,
  tagId: string,
): Promise<QrTagEvent[]> {
  const { data, error } = await supabase.rpc("qr_admin_tag_events", { p_tag_id: tagId });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    event: String(row.event),
    reason: (row.reason as string) ?? null,
    actorEmail: (row.actor_email as string) ?? null,
    createdAt: String(row.created_at),
  }));
}

export async function searchPetsForQr(
  supabase: SupabaseClient,
  query: string,
  limit = 20,
): Promise<QrPetSearchResult[]> {
  const { data, error } = await supabase.rpc("qr_admin_search_pets", {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    petKind: row.pet_kind as QrPetKind,
    petId: String(row.pet_id),
    name: String(row.name),
    extra: (row.extra as string) ?? null,
    ownerLabel: (row.owner_label as string) ?? null,
    hasLiveTag: Boolean(row.has_live_tag),
    liveTagCode: (row.live_tag_code as string) ?? null,
  }));
}

export async function assignQrTag(
  supabase: SupabaseClient,
  input: {
    tagId: string;
    petKind: QrPetKind;
    petId: string;
    activate?: boolean;
    reason?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.rpc("qr_admin_assign", {
    p_tag_id: input.tagId,
    p_pet_kind: input.petKind,
    p_pet_id: input.petId,
    p_activate: input.activate ?? true,
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
}

export type QrStateAction = "activate" | "suspend" | "resume" | "unassign" | "annul";

export async function qrTagSetState(
  supabase: SupabaseClient,
  tagId: string,
  action: QrStateAction,
  reason?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("qr_admin_set_state", {
    p_tag_id: tagId,
    p_action: action,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

export async function replaceQrTag(
  supabase: SupabaseClient,
  input: { oldTagId: string; newTagId: string; reason?: string | null },
): Promise<void> {
  const { error } = await supabase.rpc("qr_admin_replace", {
    p_old_tag_id: input.oldTagId,
    p_new_tag_id: input.newTagId,
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
}

export async function exportQrBatch(
  supabase: SupabaseClient,
  batchId: string,
  fromCode?: string | null,
  toCode?: string | null,
): Promise<QrExportRow[]> {
  const { data, error } = await supabase.rpc("qr_admin_export_batch", {
    p_batch_id: batchId,
    p_from_code: fromCode ?? null,
    p_to_code: toCode ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    shortCode: String(row.short_code),
    publicId: String(row.public_id),
    status: row.status as QrTagStatus,
  }));
}
