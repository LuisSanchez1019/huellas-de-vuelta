import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pet, PetAgeUnit, PetInput, PetSex, PetSpecies, PetStatus } from "./types";
import {
  PUBLIC_ADOPTIONS_TAG,
  PUBLIC_LOST_PETS_TAG,
  PUBLIC_STATS_TAG,
  triggerPublicRevalidate,
} from "@/lib/cache/tags";

const TABLE = "pets";

export const PET_PHOTO_BUCKET = "pet-photos";

export async function fetchPets(
  supabase: SupabaseClient,
  options: { includeArchived?: boolean } = {},
): Promise<Pet[]> {
  let query = supabase.from(TABLE).select("*").order("created_at", { ascending: false });
  if (!options.includeArchived) {
    query = query.eq("is_archived", false);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Pet[];
}

export async function fetchPet(supabase: SupabaseClient, id: string): Promise<Pet | null> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Pet | null;
}

export async function createPet(supabase: SupabaseClient, ownerId: string, input: PetInput): Promise<Pet> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  // Cambia "Mascotas registradas" del Landing.
  triggerPublicRevalidate(PUBLIC_STATS_TAG);
  return data as Pet;
}

export async function updatePet(
  supabase: SupabaseClient,
  id: string,
  input: Partial<PetInput>,
): Promise<Pet> {
  const { data, error } = await supabase.from(TABLE).update(input).eq("id", id).select().single();
  if (error) throw error;
  // Si cambió el estado, puede entrar/salir de "Adopciones" o "Perdidas".
  if (input.status !== undefined) {
    triggerPublicRevalidate([PUBLIC_ADOPTIONS_TAG, PUBLIC_LOST_PETS_TAG, PUBLIC_STATS_TAG]);
  }
  return data as Pet;
}

/** Borra la mascota. `pet_reports` se elimina en cascada, evitando reportes huerfanos. */
export async function deletePet(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
  triggerPublicRevalidate([PUBLIC_STATS_TAG, PUBLIC_ADOPTIONS_TAG, PUBLIC_LOST_PETS_TAG]);
}

export async function setPetArchived(supabase: SupabaseClient, id: string, isArchived: boolean): Promise<Pet> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_archived: isArchived })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Pet;
}

export async function setPetPhotoPath(supabase: SupabaseClient, id: string, photoPath: string | null): Promise<Pet> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ photo_path: photoPath })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Pet;
}

/**
 * Sube la foto ya redimensionada al bucket privado `pet-photos`. La ruta usa la
 * carpeta del propietario (`<owner_id>/...`), que es lo que exigen las políticas
 * RLS de Storage. Devuelve la ruta del objeto (no una URL).
 */
export async function uploadPetPhoto(
  supabase: SupabaseClient,
  ownerId: string,
  petId: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  const extension = contentType === "image/jpeg" ? "jpg" : "webp";
  const path = `${ownerId}/${petId}.${extension}`;
  const { error } = await supabase.storage
    .from(PET_PHOTO_BUCKET)
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

export type PublicPetTagState =
  | "active"
  | "assigned"
  | "suspended"
  | "replaced"
  | "annulled"
  | "legacy";

export interface PublicPet {
  publicId: string;
  name: string;
  species: PetSpecies;
  speciesOther: string | null;
  breed: string | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorTertiary: string | null;
  ageValue: number | null;
  ageUnit: PetAgeUnit | null;
  /** Edad en texto libre (mascotas de organización, que no usan valor + unidad). */
  ageText: string | null;
  sex: PetSex | null;
  description: string | null;
  status: PetStatus;
  photoPath: string | null;
  /** Datos del reporte de pérdida activo (solo si `status === "lost"`). */
  reportId: string | null;
  reportStage: string | null;
  lostCity: string | null;
  lostNeighborhood: string | null;
  lostDetails: string | null;
  reportedAt: string | null;
  /** Código corto de la placa (HV-…) cuando se resolvió por placa. */
  plateCode: string | null;
  /** Origen de la mascota: `owner` (usuario) u `org` (organización). */
  sourceKind: "owner" | "org" | null;
  /** Estado de la placa. `null` cuando el perfil se muestra pero la placa no aplica. */
  tagState: PublicPetTagState | null;
  /** Hay una necesidad médica registrada y el propietario autorizó mostrar la alerta. */
  medicalAlert: boolean;
  /** El propietario autorizó indicar que requiere medicamento urgente. */
  medicalUrgent: boolean;
}

/** Resultado de resolver una placa que existe pero cuyo perfil no debe mostrarse. */
export interface PublicPetInactive {
  publicId: string;
  plateCode: string | null;
  tagState: Exclude<PublicPetTagState, "active" | "legacy">;
}

export type PublicPetResult =
  | { kind: "pet"; pet: PublicPet }
  | { kind: "inactive"; info: PublicPetInactive }
  | { kind: "not-found" };

/**
 * Datos públicos de una mascota por su `public_id` de placa o histórico (para
 * la página del QR). Llama al RPC `get_public_pet`, que resuelve la placa
 * (`qr_tags`) y solo devuelve columnas seguras (sin owner). También informa si
 * la placa existe pero no está activa (reemplazada, suspendida, anulada).
 */
export async function fetchPublicPet(
  supabase: SupabaseClient,
  publicId: string,
): Promise<PublicPetResult> {
  const { data, error } = await supabase.rpc("get_public_pet", { p_public_id: publicId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null;
  if (!row) return { kind: "not-found" };

  const tagState = (row.tag_state as PublicPetTagState | null) ?? null;

  if (!row.name) {
    if (
      tagState === "assigned" ||
      tagState === "suspended" ||
      tagState === "replaced" ||
      tagState === "annulled"
    ) {
      return {
        kind: "inactive",
        info: {
          publicId: String(row.public_id),
          plateCode: (row.plate_code as string) ?? null,
          tagState,
        },
      };
    }
    return { kind: "not-found" };
  }

  return {
    kind: "pet",
    pet: {
      publicId: String(row.public_id),
      name: String(row.name),
      species: row.species as PetSpecies,
      speciesOther: (row.species_other as string) ?? null,
      breed: (row.breed as string) ?? null,
      colorPrimary: (row.color_primary as string) ?? null,
      colorSecondary: (row.color_secondary as string) ?? null,
      colorTertiary: (row.color_tertiary as string) ?? null,
      ageValue: (row.age_value as number) ?? null,
      ageUnit: (row.age_unit as PetAgeUnit) ?? null,
      ageText: (row.age_text as string) ?? null,
      sex: (row.sex as PetSex) ?? null,
      description: (row.description as string) ?? null,
      status: row.status as PetStatus,
      photoPath: (row.photo_path as string) ?? null,
      reportId: (row.report_id as string) ?? null,
      reportStage: (row.report_stage as string) ?? null,
      lostCity: (row.lost_city as string) ?? null,
      lostNeighborhood: (row.lost_neighborhood as string) ?? null,
      lostDetails: (row.lost_details as string) ?? null,
      reportedAt: (row.reported_at as string) ?? null,
      plateCode: (row.plate_code as string) ?? null,
      sourceKind: (row.source_kind as "owner" | "org" | null) ?? null,
      tagState,
      medicalAlert: Boolean(row.medical_alert),
      medicalUrgent: Boolean(row.medical_urgent),
    },
  };
}

/** URL firmada temporal para mostrar una foto del bucket privado. `null` si falla. */
export async function getPetPhotoSignedUrl(
  supabase: SupabaseClient,
  photoPath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(PET_PHOTO_BUCKET)
      .createSignedUrl(photoPath, expiresInSeconds);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
