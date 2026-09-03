import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgLogoPublicUrl } from "@/lib/supabase/orgProfiles";
import type { OrgCategory } from "@/lib/pets/reencuentro";
import { isValidLatLng } from "./config";

/** Tipo de organización para el marcador (deriva de `kind`). */
export type MapOrgKind = "veterinaria" | "fundacion";

export interface MapOrgHours {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

/**
 * Datos PÚBLICOS de una organización para el mapa. Provienen de la RPC
 * `list_map_organizations`, que solo devuelve organizaciones
 * publicadas + aprobadas + activas y con coordenadas válidas, y solo columnas
 * públicas (sin correo, sin datos de la cuenta, sin estado de aprobación).
 */
export interface MapOrg {
  id: string;
  kind: MapOrgKind;
  category: OrgCategory;
  name: string;
  description: string | null;
  logoUrl: string | null;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  whatsapp: string | null;
  hours: MapOrgHours[];
  services: string[];
  mapUrl: string | null;
}

interface RawMapOrgRow {
  id: string;
  kind: string;
  category: string;
  name: string;
  description: string | null;
  logo_path: string | null;
  logo_url: string | null;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  whatsapp: string | null;
  hours: unknown;
  services: unknown;
  map_url: string | null;
}

function normalizeHours(value: unknown): MapOrgHours[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((h): h is Record<string, unknown> => typeof h === "object" && h !== null)
    .map((h) => ({
      day: String(h.day ?? ""),
      open: String(h.open ?? ""),
      close: String(h.close ?? ""),
      closed: Boolean(h.closed),
    }));
}

function toKind(kind: string, category: string): MapOrgKind {
  if (kind === "veterinaria" || kind === "fundacion") return kind;
  return category === "veterinaria" ? "veterinaria" : "fundacion";
}

/**
 * Trae en UNA sola llamada todos los marcadores del mapa público.
 * El filtrado por aprobación/actividad/coordenadas ocurre en la base de datos.
 */
export async function fetchMapOrganizations(supabase: SupabaseClient): Promise<MapOrg[]> {
  const { data, error } = await supabase.rpc("list_map_organizations");
  if (error) throw error;

  const rows = (Array.isArray(data) ? data : []) as RawMapOrgRow[];
  return rows
    .map((row): MapOrg | null => {
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!isValidLatLng(lat, lng)) return null; // defensa extra en cliente
      return {
        id: String(row.id),
        kind: toKind(String(row.kind), String(row.category)),
        category: (["veterinaria", "fundacion", "refugio", "otro_aliado"].includes(row.category)
          ? row.category
          : "otro_aliado") as OrgCategory,
        name: String(row.name),
        description: row.description?.trim() || null,
        logoUrl: row.logo_path
          ? getOrgLogoPublicUrl(supabase, row.logo_path)
          : row.logo_url || null,
        city: row.city,
        neighborhood: row.neighborhood,
        address: row.address,
        lat,
        lng,
        phone: row.phone,
        whatsapp: row.whatsapp,
        hours: normalizeHours(row.hours),
        services: Array.isArray(row.services) ? row.services.map(String) : [],
        mapUrl: row.map_url,
      };
    })
    .filter((o): o is MapOrg => o !== null);
}
