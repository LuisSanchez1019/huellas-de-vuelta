import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";

export type OrgProfileRow = Database["public"]["Tables"]["organization_profiles"]["Row"];
export type OrgProfileKind = "fundacion" | "veterinaria";
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
  services: string[];
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
    services: fields.services,
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
  if (error) throw error;
  return data as OrgProfileRow;
}

export async function listPublishedOrgProfileRows(kind: OrgProfileKind): Promise<OrgProfileRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organization_profiles")
    .select("*")
    .eq("kind", kind)
    .eq("status", "published")
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data as OrgProfileRow[]) ?? [];
}
