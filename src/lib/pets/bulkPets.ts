import type { PetSex, PetSpecies } from "@/lib/supabase/types";

export type OrgKind = "fundacion" | "veterinaria";

export interface OrgScope {
  kind: OrgKind;
  id: string;
  name: string;
}

export type BulkPetStatus = "available" | "in_treatment" | "reserved" | "adopted";

export const bulkStatusLabels: Record<BulkPetStatus, string> = {
  available: "Disponible",
  in_treatment: "En tratamiento",
  reserved: "Reservada",
  adopted: "Con hogar",
};

export const bulkStatusOptions = Object.entries(bulkStatusLabels) as [BulkPetStatus, string][];

/**
 * Mascota gestionada por una fundación o veterinaria vía carga masiva.
 * Es un modelo aparte del `Pet` de Supabase (que es propiedad de un usuario
 * final): aquí `orgId`/`orgKind` identifican a la organización dueña.
 */
export interface BulkPet {
  id: string;
  name: string;
  species: PetSpecies;
  speciesOther: string | null;
  breed: string | null;
  age: string | null;
  sex: PetSex;
  status: BulkPetStatus;
  photoUrl: string | null;
  intakeDate: string; // ISO (YYYY-MM-DD)
  orgKind: OrgKind;
  orgId: string;
  orgName: string;
  needsHome: boolean; // "buscar casa" / adopción
  needsSponsor: boolean; // "buscar padrino monetario"
  createdAt: string; // ISO datetime
}

export interface BulkPetInput {
  name: string;
  species: PetSpecies;
  speciesOther?: string | null;
  breed?: string | null;
  age?: string | null;
  sex: PetSex;
  status?: BulkPetStatus;
  photoUrl?: string | null;
  intakeDate?: string | null;
}

export function isBulkPetStatus(value: unknown): value is BulkPetStatus {
  return value === "available" || value === "in_treatment" || value === "reserved" || value === "adopted";
}
