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
import { PET_PHOTO_BUCKET } from "./pets";
import { PUBLIC_LOST_PETS_TAG, PUBLIC_ORGS_TAG } from "@/lib/cache/tags";
import type { OrgCategory } from "@/lib/pets/reencuentro";
import type { OrgCardData } from "@/components/landing/OrgCard";

export { PUBLIC_ORGS_TAG, PUBLIC_LOST_PETS_TAG };

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
    return Promise.all(
      rows.map(async (row) => {
        if (!row.photoPath) return { ...row, photoUrl: null };
        const { data } = await supabase.storage
          .from(PET_PHOTO_BUCKET)
          .createSignedUrl(row.photoPath, 3600);
        return { ...row, photoUrl: data?.signedUrl ?? null };
      }),
    );
  },
  ["public-lost-pets"],
  { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_LOST_PETS_TAG] },
);
