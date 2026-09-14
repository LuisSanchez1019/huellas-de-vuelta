import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgLogoPublicUrl } from "./orgProfiles";
import { getPetPhotoSignedUrl } from "./pets";

/**
 * Mascotas públicas de organizaciones (RPC `list_public_org_pets`, la misma
 * que usa la Landing) leídas del lado del cliente — para pantallas de panel
 * autenticadas (p. ej. "Apadrina una mascota" del aliado) que no pueden usar
 * la caché de servidor de `publicCache.ts`. Mismos datos reales, sin mocks.
 */
export interface PublicOrgPetRow {
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

export async function fetchPublicOrgPets(supabase: SupabaseClient): Promise<PublicOrgPetRow[]> {
  const { data, error } = await supabase.rpc("list_public_org_pets");
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  return Promise.all(
    rows.map(async (row) => {
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
        photoUrl: photoPath ? await getPetPhotoSignedUrl(supabase, photoPath) : null,
        org: {
          id: String(row.org_id ?? ""),
          name: String(row.org_name ?? ""),
          kind: String(row.org_kind ?? ""),
          city: (row.org_city as string) ?? null,
          neighborhood: (row.org_neighborhood as string) ?? null,
          logoUrl: logoPath ? getOrgLogoPublicUrl(supabase, logoPath) : ((row.org_logo_url as string) ?? null),
          whatsapp: (row.org_whatsapp as string) ?? null,
        },
      };
    }),
  );
}
