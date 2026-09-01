export type PetSpecies = "dog" | "cat" | "other";
export type PetStatus = "at_home" | "lost" | "found" | "for_adoption";
export type PetSex = "male" | "female" | "unspecified";
export type PetAgeUnit = "months" | "years";

export interface Pet {
  id: string;
  public_id: string;
  owner_id: string;
  name: string;
  species: PetSpecies;
  species_other: string | null;
  breed: string | null;
  color: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  color_tertiary: string | null;
  age_value: number | null;
  age_unit: PetAgeUnit | null;
  sex: PetSex | null;
  description: string | null;
  status: PetStatus;
  photo_path: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// Los campos base son obligatorios; el resto es opcional para que tanto el
// formulario nuevo (panel) como las pantallas antiguas de /mascotas puedan
// construir un PetInput con el subconjunto que cada una maneja.
export interface PetInput {
  name: string;
  species: PetSpecies;
  status: PetStatus;
  species_other?: string | null;
  breed?: string | null;
  color?: string | null;
  color_primary?: string | null;
  color_secondary?: string | null;
  color_tertiary?: string | null;
  age_value?: number | null;
  age_unit?: PetAgeUnit | null;
  sex?: PetSex | null;
  description?: string | null;
  photo_path?: string | null;
}
