export type PetSpecies = "dog" | "cat" | "other";
export type PetStatus = "at_home" | "lost" | "found" | "for_adoption";

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  color: string | null;
  description: string | null;
  status: PetStatus;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface PetInput {
  name: string;
  species: PetSpecies;
  breed: string | null;
  color: string | null;
  description: string | null;
  status: PetStatus;
}
