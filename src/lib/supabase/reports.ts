import type { SupabaseClient } from "@supabase/supabase-js";
import type { LostLocationInput, PetReport, PetReportStatus, PublicLostPet } from "@/lib/pets/reports";
import type { PetAgeUnit, PetSex, PetSpecies } from "./types";

const TABLE = "pet_reports";

/** Reportes del usuario autenticado, con la mascota anidada, para el panel. */
export async function fetchMyReports(
  supabase: SupabaseClient,
  status: PetReportStatus,
): Promise<PetReport[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*, pet:pets(name, species, species_other, breed, photo_path, status)")
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PetReport[];
}

/** Todos los reportes activos del usuario, indexados por `pet_id` (para las tarjetas). */
export async function fetchActiveReportsByPet(
  supabase: SupabaseClient,
): Promise<Record<string, PetReport>> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("status", "active");
  if (error) throw error;
  const map: Record<string, PetReport> = {};
  for (const row of (data ?? []) as PetReport[]) map[row.pet_id] = row;
  return map;
}

export async function fetchActiveReportForPet(
  supabase: SupabaseClient,
  petId: string,
): Promise<PetReport | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("pet_id", petId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return (data as PetReport) ?? null;
}

export type PanelPetStatus = "at_home" | "lost" | "for_adoption";

/**
 * Cambia el estado de una mascota y crea/cierra su reporte de perdida (RPC atomico).
 * Para `lost` se requiere `loc` con ciudad y barrio.
 */
export async function setPetStatus(
  supabase: SupabaseClient,
  petId: string,
  status: PanelPetStatus,
  loc?: LostLocationInput,
): Promise<void> {
  const { error } = await supabase.rpc("set_pet_status", {
    p_pet_id: petId,
    p_status: status,
    p_city: loc?.city ?? null,
    p_neighborhood: loc?.neighborhood ?? null,
    p_details: loc?.details ?? null,
  });
  if (error) throw error;
}

/** Mascotas con reporte de perdida activo, para la landing (sin datos del propietario). */
export async function fetchPublicLostPets(supabase: SupabaseClient): Promise<PublicLostPet[]> {
  const { data, error } = await supabase.rpc("list_public_lost_pets");
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  return rows.map((row) => ({
    reportId: String(row.report_id),
    publicId: String(row.public_id),
    name: String(row.name),
    species: row.species as PetSpecies,
    speciesOther: (row.species_other as string) ?? null,
    breed: (row.breed as string) ?? null,
    ageValue: (row.age_value as number) ?? null,
    ageUnit: (row.age_unit as PetAgeUnit) ?? null,
    sex: (row.sex as PetSex) ?? null,
    colorPrimary: (row.color_primary as string) ?? null,
    colorSecondary: (row.color_secondary as string) ?? null,
    colorTertiary: (row.color_tertiary as string) ?? null,
    city: String(row.city),
    neighborhood: String(row.neighborhood),
    details: (row.details as string) ?? null,
    photoPath: (row.photo_path as string) ?? null,
    reportedAt: String(row.reported_at),
  }));
}
