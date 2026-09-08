import { unstable_cache } from "next/cache";
import { createSupabasePublicServerClient } from "./serverPublic";
import { fetchMapOrganizations, normalizeHours, type MapOrg } from "@/lib/map/orgMap";
import { fetchPublicLostPets } from "./reports";
import {
  getOrgLogoPublicUrl,
  listPublishedOrgProfilesWithServices,
  type OrgProfileKind,
  type OrgServiceRef,
} from "./orgProfiles";
import type { PublicLostPet } from "@/lib/pets/reports";
import type { PetAgeUnit, PetSex, PetSpecies } from "./types";
import { PET_PHOTO_BUCKET } from "./pets";
import {
  PUBLIC_ADOPTIONS_TAG,
  PUBLIC_LOST_PETS_TAG,
  PUBLIC_ORGS_TAG,
  PUBLIC_STATS_TAG,
} from "@/lib/cache/tags";
import type { OrgCategory } from "@/lib/pets/reencuentro";
import type { OrgCardData } from "@/components/landing/OrgCard";

export { PUBLIC_ORGS_TAG, PUBLIC_LOST_PETS_TAG, PUBLIC_ADOPTIONS_TAG, PUBLIC_STATS_TAG };

/**
 * Caché de datos PÚBLICOS reutilizados por Landing/mapa (organizaciones
 * aprobadas+activas, mascotas perdidas activas). Nunca cachea nada que
 * dependa de la sesión del usuario ni datos privados: todas las funciones
 * aquí llaman a las mismas RPC/queries `anon` que ya usa el cliente,
 * simplemente compartiendo el resultado entre visitantes por un rato en vez
 * de repetir la consulta en cada carga del Landing.
 *
 * Revalidación: por tiempo (`REVALIDATE_SECONDS`, red de seguridad) y por
 * `revalidateTag` explícito (`triggerPublicRevalidate`) justo después de las
 * mutaciones que cambian qué aparece públicamente (aprobar/activar
 * organización, publicar/guardar perfil, cambiar estado de mascota).
 */
const REVALIDATE_SECONDS = 120;

/**
 * Firma en UNA sola llamada (`createSignedUrls`) las fotos privadas de un
 * conjunto de mascotas y devuelve un mapa `path -> URL firmada`. Evita el N+1
 * de firmar una por una. La firma dura 1h, muy por encima de la ventana de
 * revalidación de estos cachés.
 */
async function signPetPhotoUrls(
  supabase: ReturnType<typeof createSupabasePublicServerClient>,
  paths: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await supabase.storage
    .from(PET_PHOTO_BUCKET)
    .createSignedUrls(unique, 3600);
  const map = new Map<string, string>();
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl && !entry.error) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

function toCardData(
  row: Awaited<ReturnType<typeof listPublishedOrgProfilesWithServices>>[number]["row"],
  services: OrgServiceRef[],
  logoUrl: string | null,
): OrgCardData {
  const category = (
    ["veterinaria", "fundacion", "refugio", "otro_aliado"].includes(row.category)
      ? row.category
      : row.kind
  ) as OrgCategory;
  return {
    id: row.id,
    name: row.name,
    category,
    logoUrl,
    description: row.description ?? "",
    city: row.city ?? "",
    neighborhood: row.neighborhood ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    hours: normalizeHours(row.hours),
    mapUrl: row.map_url,
    lat: row.lat,
    lng: row.lng,
    services,
  };
}

/** Organizaciones aprobadas+activas de un tipo, con sus servicios ya resueltos (Landing). */
export const getCachedPartnerOrgs = unstable_cache(
  async (kind: OrgProfileKind): Promise<OrgCardData[]> => {
    const supabase = createSupabasePublicServerClient();
    const entries = await listPublishedOrgProfilesWithServices(kind, supabase);
    return entries.map(({ row, services }) =>
      toCardData(row, services, row.logo_path ? getOrgLogoPublicUrl(supabase, row.logo_path) : row.logo_url),
    );
  },
  ["partner-orgs"],
  { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_ORGS_TAG] },
);

/** Organizaciones aprobadas+activas con coordenadas, para el mapa del Landing. */
export const getCachedMapOrganizations = unstable_cache(
  async (): Promise<MapOrg[]> => fetchMapOrganizations(createSupabasePublicServerClient()),
  ["map-organizations"],
  { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_ORGS_TAG] },
);

export interface PublicLostPetWithPhoto extends PublicLostPet {
  photoUrl: string | null;
}

/**
 * Mascotas con reporte de pérdida activo + URL firmada de su foto (el bucket
 * es privado; la firma se cachea igual que el resto — dura 1h, muy por
 * encima de la ventana de revalidación de este caché).
 */
export const getCachedPublicLostPets = unstable_cache(
  async (): Promise<PublicLostPetWithPhoto[]> => {
    const supabase = createSupabasePublicServerClient();
    const rows = await fetchPublicLostPets(supabase);
    const signed = await signPetPhotoUrls(
      supabase,
      rows.map((row) => row.photoPath).filter((p): p is string => Boolean(p)),
    );
    return rows.map((row) => ({
      ...row,
      photoUrl: row.photoPath ? signed.get(row.photoPath) ?? null : null,
    }));
  },
  ["public-lost-pets"],
  { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_LOST_PETS_TAG] },
);

export interface PublicAdoptionPet {
  publicId: string;
  name: string;
  species: PetSpecies;
  speciesOther: string | null;
  breed: string | null;
  ageValue: number | null;
  ageUnit: PetAgeUnit | null;
  sex: PetSex | null;
  description: string | null;
  photoUrl: string | null;
}

/**
 * Mascotas REALES en adopción (RPC `list_public_adoption_pets`, solo columnas
 * públicas — nunca datos del propietario) + URL firmada de su foto. Se
 * actualiza sola al cambiar el estado de una mascota (`set_pet_status`
 * invalida `PUBLIC_ADOPTIONS_TAG`).
 */
export const getCachedAdoptionPets = unstable_cache(
  async (): Promise<PublicAdoptionPet[]> => {
    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase.rpc("list_public_adoption_pets");
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const signed = await signPetPhotoUrls(
      supabase,
      rows.map((row) => (row.photo_path as string) ?? "").filter(Boolean),
    );
    return rows.map((row) => {
      const photoPath = (row.photo_path as string) ?? null;
      return {
        publicId: String(row.public_id),
        name: String(row.name),
        species: row.species as PetSpecies,
        speciesOther: (row.species_other as string) ?? null,
        breed: (row.breed as string) ?? null,
        ageValue: (row.age_value as number) ?? null,
        ageUnit: (row.age_unit as PetAgeUnit) ?? null,
        sex: (row.sex as PetSex) ?? null,
        description: (row.description as string) ?? null,
        photoUrl: photoPath ? signed.get(photoPath) ?? null : null,
      };
    });
  },
  ["public-adoption-pets"],
  { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_ADOPTIONS_TAG] },
);

export interface LandingStat {
  key: string;
  value: number;
  label: string;
}

/**
 * Estadísticas REALES del Landing (RPC `public_landing_stats`, una sola
 * consulta, sin N+1). Solo métricas que la estructura actual permite
 * calcular de forma fiable.
 */
export const getCachedLandingStats = unstable_cache(
  async (): Promise<LandingStat[]> => {
    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase.rpc("public_landing_stats");
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!row) return [];
    return [
      { key: "registered", value: Number(row.pets_registered ?? 0), label: "Mascotas registradas" },
      { key: "reunions", value: Number(row.reunions ?? 0), label: "Reencuentros" },
      { key: "lost", value: Number(row.pets_lost_now ?? 0), label: "Perdidas ahora" },
      { key: "orgs", value: Number(row.partner_orgs ?? 0), label: "Organizaciones aliadas" },
    ];
  },
  ["public-landing-stats"],
  { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_STATS_TAG] },
);

export interface PublicReunion {
  reportId: string;
  species: PetSpecies;
  speciesOther: string | null;
  city: string;
  neighborhood: string | null;
  closedAt: string;
}

/**
 * Reencuentros REALES (RPC `list_public_reunions`): reportes de pérdida ya
 * cerrados. Solo datos públicos — sin propietario ni testimonios inventados.
 * Cacheado y ligado a `PUBLIC_LOST_PETS_TAG` (misma tabla origen), así que se
 * refresca cuando una mascota cambia de estado.
 */
export const getCachedReunions = unstable_cache(
  async (): Promise<PublicReunion[]> => {
    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase.rpc("list_public_reunions");
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    return rows.map((row) => ({
      reportId: String(row.report_id),
      species: (row.species as PetSpecies) ?? "other",
      speciesOther: (row.species_other as string) ?? null,
      city: String(row.city ?? ""),
      neighborhood: (row.neighborhood as string) ?? null,
      closedAt: String(row.closed_at ?? ""),
    }));
  },
  ["public-reunions"],
  { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_LOST_PETS_TAG] },
);
