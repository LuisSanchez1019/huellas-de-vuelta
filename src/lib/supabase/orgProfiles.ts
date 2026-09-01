import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";

export type OrgProfileRow = Database["public"]["Tables"]["organization_profiles"]["Row"];
export type OrgProfileKind = "fundacion" | "veterinaria";

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
  logoUrl: string;
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
    slug: slugify(fields.name, kind),
    name: fields.name,
    logo_url: fields.logoUrl || null,
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
    .order("name");
  if (error) throw error;
  return (data as OrgProfileRow[]) ?? [];
}
