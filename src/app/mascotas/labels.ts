import type { PetSpecies, PetStatus } from "@/lib/supabase/types";

export const speciesLabels: Record<PetSpecies, string> = {
  dog: "Perro",
  cat: "Gato",
  other: "Otro",
};

export const statusLabels: Record<PetStatus, string> = {
  at_home: "En casa",
  lost: "Perdido",
  found: "Encontrado",
  for_adoption: "En adopción",
};

export const speciesOptions = Object.entries(speciesLabels) as [PetSpecies, string][];
export const statusOptions = Object.entries(statusLabels) as [PetStatus, string][];
