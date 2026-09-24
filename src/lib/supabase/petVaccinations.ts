import type { SupabaseClient } from "@supabase/supabase-js";
import { vetErrorCode, vetErrorMessage } from "@/lib/vet/errors";

/**
 * Vacunas de una mascota de usuario. Es un dato médico: solo el propietario las lee
 * (RLS) y toda escritura pasa por RPC que validan propiedad y fechas en el servidor.
 * Se eliminan en cascada con la mascota (sin archivo ni copia).
 */

export interface Vaccination {
  id: string;
  petId: string;
  vaccineName: string;
  applicationDate: string;
  nextDoseDate: string | null;
  lotNumber: string | null;
  veterinaryName: string | null;
  notes: string | null;
}

export interface VaccinationInput {
  vaccineName: string;
  applicationDate: string;
  nextDoseDate: string;
  lotNumber: string;
  veterinaryName: string;
  notes: string;
}

export const VACCINATION_LIMITS = { name: 100, lot: 60, veterinary: 120, notes: 500 } as const;

const MESSAGES: Record<string, string> = {
  PET_NOT_FOUND: "No encontramos esa mascota en tu cuenta.",
  VACCINATION_NOT_FOUND: "No encontramos esa vacuna.",
  INVALID_DATE: "Revisa las fechas: la aplicación no puede ser futura ni anterior al nacimiento, y la próxima dosis debe ser posterior.",
  DUPLICATE_VACCINATION: "Ya registraste esa vacuna con esa misma fecha de aplicación.",
  TOO_MANY: "Alcanzaste el máximo de vacunas registradas para esta mascota.",
};

export function vaccinationErrorMessage(error: unknown): string {
  const code = vetErrorCode(error);
  return (code && MESSAGES[code]) || vetErrorMessage(error);
}

export async function fetchVaccinations(supabase: SupabaseClient, petId: string): Promise<Vaccination[]> {
  const { data, error } = await supabase
    .from("pet_vaccinations")
    .select("id, pet_id, vaccine_name, application_date, next_dose_date, lot_number, veterinary_name, notes")
    .eq("pet_id", petId)
    .order("application_date", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    petId: row.pet_id as string,
    vaccineName: row.vaccine_name as string,
    applicationDate: row.application_date as string,
    nextDoseDate: (row.next_dose_date as string | null) ?? null,
    lotNumber: (row.lot_number as string | null) ?? null,
    veterinaryName: (row.veterinary_name as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  }));
}

const blank = (value: string): string | null => (value.trim() ? value.trim() : null);

export async function addVaccination(supabase: SupabaseClient, petId: string, input: VaccinationInput): Promise<void> {
  const { error } = await supabase.rpc("pet_vaccination_add", {
    p_pet_id: petId,
    p_vaccine_name: input.vaccineName,
    p_application_date: input.applicationDate,
    p_next_dose_date: input.nextDoseDate || undefined,
    p_lot_number: blank(input.lotNumber) ?? undefined,
    p_veterinary_name: blank(input.veterinaryName) ?? undefined,
    p_notes: blank(input.notes) ?? undefined,
  });
  if (error) throw error;
}

export async function updateVaccination(supabase: SupabaseClient, id: string, input: VaccinationInput): Promise<void> {
  const { error } = await supabase.rpc("pet_vaccination_update", {
    p_id: id,
    p_vaccine_name: input.vaccineName,
    p_application_date: input.applicationDate,
    p_next_dose_date: input.nextDoseDate || undefined,
    p_lot_number: blank(input.lotNumber) ?? undefined,
    p_veterinary_name: blank(input.veterinaryName) ?? undefined,
    p_notes: blank(input.notes) ?? undefined,
  });
  if (error) throw error;
}

export async function deleteVaccination(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.rpc("pet_vaccination_delete", { p_id: id });
  if (error) throw error;
}
