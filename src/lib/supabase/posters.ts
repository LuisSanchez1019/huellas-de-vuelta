import type { SupabaseClient } from "@supabase/supabase-js";

/** Bucket PRIVADO con las imagenes de los posters. La Landing firma las URL
 *  server-side; un poster pendiente no es accesible por URL publica. */
export const POSTER_BUCKET = "org-posters";

export type PosterStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "inactive";

export type PosterReviewAction = "approve" | "reject" | "deactivate";

export interface MyPoster {
  id: string;
  imagePath: string;
  title: string | null;
  description: string | null;
  targetUrl: string | null;
  status: PosterStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  isLive: boolean;
}

export interface PosterQuota {
  approvedLast7d: number;
  weeklyLimit: number;
  hasLive: boolean;
  hasPending: boolean;
  nextSlotAt: string | null;
}

export interface AdminPoster {
  id: string;
  organizationId: string;
  orgName: string;
  orgKind: string;
  orgCategory: string;
  ownerEmail: string | null;
  imagePath: string;
  title: string | null;
  description: string | null;
  targetUrl: string | null;
  status: PosterStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  isLive: boolean;
}

export interface PosterInput {
  id?: string | null;
  imagePath: string;
  title?: string | null;
  description?: string | null;
  targetUrl?: string | null;
}

/** Solo `http(s)://`. Bloquea `javascript:`, `data:`, `vbscript:`, espacios, etc. */
export function isSafePosterUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function isExpired(status: PosterStatus, expiresAt: string | null): boolean {
  return status === "approved" && !!expiresAt && new Date(expiresAt).getTime() <= Date.now();
}

/** Estado que se muestra al usuario (un 'approved' ya vencido se ve como 'expired'). */
export function displayPosterStatus(status: PosterStatus, expiresAt: string | null): PosterStatus {
  return isExpired(status, expiresAt) ? "expired" : status;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
export async function uploadPosterImage(
  supabase: SupabaseClient,
  ownerId: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  const path = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(POSTER_BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

export async function deletePosterImage(supabase: SupabaseClient, path: string): Promise<void> {
  try {
    await supabase.storage.from(POSTER_BUCKET).remove([path]);
  } catch {
    /* best-effort */
  }
}

export async function getPosterSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data } = await supabase.storage.from(POSTER_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function getPosterSignedUrls(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.storage.from(POSTER_BUCKET).createSignedUrls(unique, 3600);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl && !entry.error) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------
interface RawPosterRow {
  id: string;
  image_path: string;
  title: string | null;
  description: string | null;
  target_url: string | null;
  status: PosterStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
}

function mapMyPoster(row: RawPosterRow): MyPoster {
  return {
    id: row.id,
    imagePath: row.image_path,
    title: row.title,
    description: row.description,
    targetUrl: row.target_url,
    status: row.status,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    isLive: row.status === "approved" && !isExpired(row.status, row.expires_at),
  };
}

/** Posters de la organizacion del usuario autenticado (RLS acota a las propias). */
export async function fetchMyPosters(supabase: SupabaseClient): Promise<MyPoster[]> {
  const { data, error } = await supabase
    .from("organization_posters")
    .select(
      "id,image_path,title,description,target_url,status,rejection_reason,submitted_at,approved_at,expires_at,created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RawPosterRow[]).map(mapMyPoster);
}

/** Cupo semanal + estado. Ademas reconcilia posters vencidos en el servidor. */
export async function fetchMyPosterQuota(supabase: SupabaseClient): Promise<PosterQuota> {
  const { data, error } = await supabase.rpc("poster_my_quota");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  return {
    approvedLast7d: Number(row?.approved_last_7d ?? 0),
    weeklyLimit: Number(row?.weekly_limit ?? 2),
    hasLive: Boolean(row?.has_live),
    hasPending: Boolean(row?.has_pending),
    nextSlotAt: (row?.next_slot_at as string) ?? null,
  };
}

export async function adminListPosters(supabase: SupabaseClient): Promise<AdminPoster[]> {
  const { data, error } = await supabase.rpc("poster_admin_list");
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    orgName: String(row.org_name ?? ""),
    orgKind: String(row.org_kind ?? ""),
    orgCategory: String(row.org_category ?? ""),
    ownerEmail: (row.owner_email as string) ?? null,
    imagePath: String(row.image_path ?? ""),
    title: (row.title as string) ?? null,
    description: (row.description as string) ?? null,
    targetUrl: (row.target_url as string) ?? null,
    status: (row.status as PosterStatus) ?? "draft",
    rejectionReason: (row.rejection_reason as string) ?? null,
    submittedAt: (row.submitted_at as string) ?? null,
    approvedAt: (row.approved_at as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    createdAt: String(row.created_at ?? ""),
    isLive: Boolean(row.is_live),
  }));
}

// ---------------------------------------------------------------------------
// Escrituras (todas via RPC SECURITY DEFINER)
// ---------------------------------------------------------------------------
export async function upsertPoster(supabase: SupabaseClient, input: PosterInput): Promise<string> {
  const { data, error } = await supabase.rpc("poster_upsert", {
    p_id: input.id ?? null,
    p_image_path: input.imagePath,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_target_url: input.targetUrl ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function submitPoster(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.rpc("poster_submit", { p_id: id });
  if (error) throw error;
}

export async function deletePoster(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.rpc("poster_delete", { p_id: id });
  if (error) throw error;
}

export async function adminReviewPoster(
  supabase: SupabaseClient,
  id: string,
  action: PosterReviewAction,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("poster_admin_review", {
    p_id: id,
    p_action: action,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

/** Traduce los codigos de error de las RPC a mensajes en espanol. */
export function posterErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const map: Record<string, string> = {
    AUTH_REQUIRED: "Inicia sesión para gestionar los posters.",
    ROLE_NOT_ALLOWED: "Solo las cuentas de veterinaria o fundación pueden usar Posters.",
    NO_ORG: "Primero crea el perfil de tu organización.",
    NOT_FOUND: "El poster ya no existe.",
    NOT_EDITABLE: "Este poster ya no se puede editar (está en revisión o publicado).",
    NOT_SUBMITTABLE: "Este poster no se puede enviar a revisión en su estado actual.",
    INVALID_IMAGE: "La imagen del poster no es válida.",
    INVALID_URL: "El enlace debe empezar por https:// o http://.",
    WEEKLY_LIMIT:
      "Ya publicaste 2 posters aprobados esta semana. Podrás enviar otro cuando pasen 7 días desde la primera aprobación.",
    ALREADY_PENDING: "Ya tienes un poster en revisión. Espera la respuesta del administrador.",
    ALREADY_LIVE:
      "Tu organización ya tiene un poster vigente en la Landing. Solo puede haber uno a la vez.",
    ORG_NOT_PUBLIC: "La organización debe estar aprobada y activa para publicar posters.",
    NOT_PENDING: "El poster no está pendiente de revisión.",
    NOT_ACTIVE: "El poster no está activo.",
    INVALID_ACTION: "Acción no válida.",
    "No autorizado.": "No tienes permiso para esta acción.",
  };
  for (const key of Object.keys(map)) {
    if (raw.includes(key)) return map[key];
  }
  return raw || "No fue posible completar la operación.";
}
