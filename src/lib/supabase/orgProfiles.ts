import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";

export type OrgProfileRow = Database["public"]["Tables"]["organization_profiles"]["Row"];
export type OrgProfileKind = "fundacion" | "veterinaria";
/** Tipos que pueden tener un "nombre de organización/empresa" (incluye aliado). */
export type OrgNameKind = OrgProfileKind | "aliado";
export type OrgCategory = "veterinaria" | "fundacion" | "refugio" | "otro_aliado";

/** Bucket público con los logos de las organizaciones (visibles en el Landing). */
export const ORG_LOGO_BUCKET = "org-logos";

/**
 * Sube el logo ya preparado a `org-logos/<ownerId>/<uuid>.<ext>` y devuelve la
 * ruta del objeto. Las políticas de Storage exigen que la carpeta sea la del
 * dueño (`auth.uid()`).
 */
export async function uploadOrgLogo(
  supabase: SupabaseClient,
  ownerId: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  const extension =
    contentType === "image/svg+xml"
      ? "svg"
      : contentType === "image/jpeg"
        ? "jpg"
        : contentType === "image/png"
          ? "png"
          : "webp";
  const path = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(ORG_LOGO_BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** URL pública (permanente) del logo de una organización. */
export function getOrgLogoPublicUrl(supabase: SupabaseClient, path: string): string {
  return supabase.storage.from(ORG_LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Borra un logo del bucket (best-effort: los errores se ignoran). */
export async function deleteOrgLogo(supabase: SupabaseClient, path: string): Promise<void> {
  try {
    await supabase.storage.from(ORG_LOGO_BUCKET).remove([path]);
  } catch {
    /* sin bloqueo */
  }
}

export function slugify(value: string, fallback: string): string {
  const base = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || fallback;
}

/** Nombre normalizado (igual que la columna generada `name_norm` en BD). */
export function normalizeOrgName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * ¿El nombre de organización está libre para ese tipo? RPC `org_name_available`
 * (SECURITY DEFINER: ve todas las filas, no solo la propia). Solo UX previa; la
 * garantía real es el índice único `(kind, name_norm)` + `register_org_profile`.
 */
export async function orgNameAvailable(
  supabase: SupabaseClient,
  kind: OrgNameKind,
  name: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("org_name_available", { p_kind: kind, p_name: name });
  if (error) throw error;
  return data === true;
}

export class OrgDuplicateError extends Error {
  constructor(public kind: OrgProfileKind) {
    super("DUPLICATE_ORG");
    this.name = "OrgDuplicateError";
  }
}

/**
 * Crea (o renombra, si el dueño ya tiene una) la fila mínima de
 * `organization_profiles` en el registro: solo nombre + tipo. Queda
 * `status='draft'` y `approval_status='pending'` (aprobación del admin). El rol
 * real (`profiles.role`) debe coincidir con `kind` — lo valida la RPC en el
 * servidor. Lanza `OrgDuplicateError` si otra cuenta ya registró ese nombre.
 */
export async function registerOrgProfile(
  supabase: SupabaseClient,
  kind: OrgProfileKind,
  name: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("register_org_profile", {
    p_kind: kind,
    p_name: name,
    p_slug: slugify(name, kind),
  });
  if (error) {
    if (/DUPLICATE_ORG/.test(error.message)) throw new OrgDuplicateError(kind);
    throw error;
  }
  return String(data);
}

/** Nombre de la organización de la cuenta autenticada (o `null` si aún no existe). */
export async function fetchMyOrgName(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("organization_profiles")
    .select("name")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return (data?.name as string) ?? null;
}

/** Campos que la app escribe en `organization_profiles` (sin id/owner_id/slug/timestamps). */
export interface OrgProfileWrite {
  name: string;
  category: OrgCategory;
  logoUrl: string;
  logoPath: string;
  coverImageUrl: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: unknown[];
  social: Record<string, string>;
  address: string;
  city: string;
  neighborhood: string;
  mapUrl: string;
  lat: number | null;
  lng: number | null;
  extraInfo: string;
  status: "draft" | "published";
}

export async function fetchOrgProfileRow(
  kind: OrgProfileKind,
  ownerId: string,
): Promise<OrgProfileRow | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organization_profiles")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  return (data as OrgProfileRow) ?? null;
}

export async function upsertOrgProfileRow(
  kind: OrgProfileKind,
  ownerId: string,
  fields: OrgProfileWrite,
): Promise<OrgProfileRow> {
  const supabase = createSupabaseBrowserClient();
  const payload = {
    owner_id: ownerId,
    kind,
    category: fields.category,
    slug: slugify(fields.name, kind),
    name: fields.name,
    logo_url: fields.logoUrl || null,
    logo_path: fields.logoPath || null,
    cover_image_url: fields.coverImageUrl || null,
    description: fields.description || null,
    phone: fields.phone || null,
    whatsapp: fields.whatsapp || null,
    email: fields.email || null,
    hours: fields.hours,
    social: fields.social,
    address: fields.address || null,
    city: fields.city || null,
    neighborhood: fields.neighborhood || null,
    map_url: fields.mapUrl || null,
    lat: fields.lat,
    lng: fields.lng,
    extra_info: fields.extraInfo || null,
    status: fields.status,
  };
  const { data, error } = await supabase
    .from("organization_profiles")
    .upsert(payload, { onConflict: "owner_id" })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505" && /name_norm/.test(error.message)) {
      throw new OrgDuplicateError(kind);
    }
    throw error;
  }
  return data as OrgProfileRow;
}

/** Referencia resuelta de un servicio del catálogo (para mostrar, no para editar). */
export interface OrgServiceRef {
  slug: string;
  name: string;
  icon: string;
}

interface RawEmbeddedService {
  service_catalog: { slug: string; name: string; icon: string } | null;
}

/**
 * Organizaciones publicadas + aprobadas + activas de un tipo, con — en la
 * MISMA consulta (embed de PostgREST, sin N+1) — los servicios que cada una
 * seleccionó del catálogo, ya resueltos (slug, nombre, icono).
 */
export async function listPublishedOrgProfilesWithServices(
  kind: OrgProfileKind,
  supabase: SupabaseClient = createSupabaseBrowserClient(),
): Promise<{ row: OrgProfileRow; services: OrgServiceRef[] }[]> {
  const { data, error } = await supabase
    .from("organization_profiles")
    .select("*, organization_services(service_catalog(slug,name,icon,sort_order))")
    .eq("kind", kind)
    .eq("status", "published")
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;

  return ((data ?? []) as (OrgProfileRow & { organization_services: RawEmbeddedService[] })[]).map(
    (row) => {
      const { organization_services, ...rest } = row;
      const services = (organization_services ?? [])
        .map((os) => os.service_catalog)
        .filter((s): s is { slug: string; name: string; icon: string } => s !== null);
      return { row: rest as OrgProfileRow, services };
    },
  );
}

/** IDs de servicios (del catálogo) que una organización tiene seleccionados. */
export async function fetchOrgServiceIds(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("organization_services")
    .select("service_id")
    .eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []).map((row) => row.service_id as string);
}

/**
 * Reemplaza por completo el conjunto de servicios seleccionados por una
 * organización (borra y vuelve a insertar). RLS exige que `organizationId`
 * pertenezca al dueño autenticado (o que sea admin).
 */
export async function replaceOrgServices(
  supabase: SupabaseClient,
  organizationId: string,
  serviceIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("organization_services")
    .delete()
    .eq("organization_id", organizationId);
  if (deleteError) throw deleteError;
  if (serviceIds.length === 0) return;
  const { error: insertError } = await supabase
    .from("organization_services")
    .insert(serviceIds.map((serviceId) => ({ organization_id: organizationId, service_id: serviceId })));
  if (insertError) throw insertError;
}
