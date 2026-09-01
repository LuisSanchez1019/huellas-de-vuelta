import type { PetAgeUnit, PetSex, PetSpecies, PetStatus } from "@/lib/supabase/types";

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

export const sexLabels: Record<PetSex, string> = {
  male: "Macho",
  female: "Hembra",
  unspecified: "No especificado",
};

export const ageUnitLabels: Record<PetAgeUnit, string> = {
  months: "Meses",
  years: "Años",
};

// Lista controlada de colores para gatos. Se guarda `value` (slug estable) en la
// base de datos y se muestra `label` en la interfaz.
export const CAT_COLORS: { value: string; label: string }[] = [
  { value: "black", label: "Negro" },
  { value: "white", label: "Blanco" },
  { value: "gray", label: "Gris" },
  { value: "orange", label: "Naranja" },
  { value: "brown", label: "Marrón" },
  { value: "cream", label: "Crema" },
  { value: "beige", label: "Beige" },
  { value: "tabby", label: "Atigrado" },
  { value: "calico", label: "Carey" },
  { value: "golden", label: "Dorado" },
];

export const catColorLabels: Record<string, string> = Object.fromEntries(
  CAT_COLORS.map((color) => [color.value, color.label]),
);

export const speciesOptions = Object.entries(speciesLabels) as [PetSpecies, string][];
export const statusOptions = Object.entries(statusLabels) as [PetStatus, string][];
export const sexOptions = Object.entries(sexLabels) as [PetSex, string][];
export const ageUnitOptions = Object.entries(ageUnitLabels) as [PetAgeUnit, string][];
