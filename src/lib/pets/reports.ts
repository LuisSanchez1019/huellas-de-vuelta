import type { PetAgeUnit, PetSex, PetSpecies } from "@/lib/supabase/types";

export type PetReportStatus = "active" | "closed";

export const reportStatusLabels: Record<PetReportStatus, string> = {
  active: "Activo",
  closed: "Cerrado",
};

/** Ubicacion pedida al reportar una mascota como perdida. */
export interface LostLocationInput {
  city: string;
  neighborhood: string;
  details: string;
}

export const LOST_DETAILS_MAX = 100;

/** Etapa informativa del caso. La mascota sigue `lost` hasta que el dueño confirme. */
export type ReportStage = "reported" | "sighted" | "in_contact" | "in_organization";

/** Fila de `pet_reports` (con la mascota anidada para las listas del panel). */
export interface PetReport {
  id: string;
  pet_id: string;
  owner_id: string;
  kind: "lost";
  status: PetReportStatus;
  stage: ReportStage;
  city: string;
  neighborhood: string;
  details: string | null;
  created_at: string;
  closed_at: string | null;
  pet?: {
    name: string;
    species: PetSpecies;
    species_other: string | null;
    breed: string | null;
    photo_path: string | null;
    status: string;
  } | null;
}

/** Forma que devuelve el RPC `list_public_lost_pets` (solo datos publicos). */
export interface PublicLostPet {
  reportId: string;
  publicId: string;
  name: string;
  species: PetSpecies;
  speciesOther: string | null;
  breed: string | null;
  ageValue: number | null;
  ageUnit: PetAgeUnit | null;
  sex: PetSex | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorTertiary: string | null;
  city: string;
  neighborhood: string;
  details: string | null;
  photoPath: string | null;
  reportedAt: string;
}
