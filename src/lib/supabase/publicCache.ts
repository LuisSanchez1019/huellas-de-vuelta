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
  PUBLIC_POSTERS_TAG,
  PUBLIC_STATS_TAG,
} from "@/lib/cache/tags";
import type { OrgCategory } from "@/lib/pets/reencuentro";
import type { OrgCardData } from "@/components/landing/OrgCard";
import { getPosterSignedUrls, isSafePosterUrl } from "./posters";

export {
  PUBLIC_ORGS_TAG,
  PUBLIC_LOST_PETS_TAG,
  PUBLIC_ADOPTIONS_TAG,
  PUBLIC_STATS_TAG,
  PUBLIC_POSTERS_TAG,
};

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
/** Los posters vencen en un limite de 24 h; una ventana de caché corta evita
 *  que uno vencido siga apareciendo por caché (§28). Ademas se revalida por tag
 *  al aprobar/rechazar/desactivar/eliminar. */
const POSTERS_REVALIDATE_SECONDS = 60;

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

export interface LandingPoster {
  id: string;
  organizationId: string;
  title: string | null;
  description: string | null;
  targetUrl: string | null;
  orgName: string;
  orgKind: string;
  imageUrl: string;
}

/**
 * Hasta 4 posters vigentes para la Landing (RPC `list_public_posters`: maximo 1
 * por organizacion, rotacion cada 3 h, valida tambien el estado de la
 * organizacion). El bucket es privado: la URL de cada imagen se firma aqui,
 * server-side (la policy de Storage solo deja leer el archivo mientras el poster
 * sigue aprobado y vigente). Si un poster ya no es publico, su URL no se firma y
 * queda fuera del resultado.
 */
export const getCachedLandingPosters = unstable_cache(
  async (): Promise<LandingPoster[]> => {
    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase.rpc("list_public_posters");
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const signed = await getPosterSignedUrls(
      supabase,
      rows.map((row) => String(row.image_path ?? "")).filter(Boolean),
    );
    return rows
      .map((row): LandingPoster | null => {
        const imagePath = String(row.image_path ?? "");
        const imageUrl = signed.get(imagePath);
        if (!imageUrl) return null;
        const targetUrl = (row.target_url as string) ?? null;
        return {
          id: String(row.id),
          organizationId: String(row.organization_id),
          title: (row.title as string) ?? null,
          description: (row.description as string) ?? null,
          targetUrl: isSafePosterUrl(targetUrl) ? targetUrl : null,
          orgName: String(row.org_name ?? ""),
          orgKind: String(row.org_kind ?? ""),
          imageUrl,
        };
      })
      .filter((poster): poster is LandingPoster => poster !== null);
  },
  ["landing-posters"],
  { revalidate: POSTERS_REVALIDATE_SECONDS, tags: [PUBLIC_POSTERS_TAG] },
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

export interface PublicOrgPet {
  id: string;
  publicId: string | null;
  name: string;
  species: string;
  speciesOther: string | null;
  breed: string | null;
  age: string | null;
  sex: string | null;
  status: string;
  needsHome: boolean;
  needsSponsor: boolean;
  photoUrl: string | null;
  org: {
    id: string;
    name: string;
    kind: string;
    city: string | null;
    neighborhood: string | null;
    logoUrl: string | null;
    whatsapp: string | null;
  };
}

/**
 * Mascotas de organizaciones (veterinaria/fundación) marcadas para adopción
 * (`needs_home`) o apadrinamiento (`needs_sponsor`), solo de organizaciones
 * publicadas + aprobadas + activas (RPC `list_public_org_pets`). Incluye la
 * atribución pública de la organización — nunca su correo/teléfono privado.
 * Ligado a `PUBLIC_ADOPTIONS_TAG` y `PUBLIC_ORGS_TAG`.
 */
export const getCachedOrgPets = unstable_cache(
  async (): Promise<PublicOrgPet[]> => {
    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase.rpc("list_public_org_pets");
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const signed = await signPetPhotoUrls(
      supabase,
      rows.map((row) => (row.photo_path as string) ?? "").filter(Boolean),
    );
    return rows.map((row) => {
      const photoPath = (row.photo_path as string) ?? null;
      const logoPath = (row.org_logo_path as string) ?? null;
      return {
        id: String(row.id),
        publicId: (row.public_id as string) ?? null,
        name: String(row.name ?? ""),
        species: String(row.species ?? "other"),
        speciesOther: (row.species_other as string) ?? null,
        breed: (row.breed as string) ?? null,
        age: (row.age as string) ?? null,
        sex: (row.sex as string) ?? null,
        status: String(row.status ?? ""),
        needsHome: Boolean(row.needs_home),
        needsSponsor: Boolean(row.needs_sponsor),
        photoUrl: photoPath ? signed.get(photoPath) ?? null : null,
        org: {
          id: String(row.org_id ?? ""),
          name: String(row.org_name ?? ""),
          kind: String(row.org_kind ?? ""),
          city: (row.org_city as string) ?? null,
          neighborhood: (row.org_neighborhood as string) ?? null,
          logoUrl: logoPath
            ? getOrgLogoPublicUrl(supabase, logoPath)
            : ((row.org_logo_url as string) ?? null),
          whatsapp: (row.org_whatsapp as string) ?? null,
        },
      };
    });
  },
  ["public-org-pets"],
  { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_ADOPTIONS_TAG, PUBLIC_ORGS_TAG] },
);
