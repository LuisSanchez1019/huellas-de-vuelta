import { ageUnitLabels, sexLabels, speciesLabels } from "@/lib/pets/labels";
import { whatsappLink } from "@/lib/phone";
import type {
  PublicAdoptionPet,
  PublicLostPetWithPhoto,
  PublicOrgPet,
} from "@/lib/supabase/publicCache";
import type { LostPetCardData } from "@/components/landing/PetCard";
import type { AdoptionItem } from "@/components/landing/AdoptionCard";

/**
 * Mapeos compartidos de filas públicas (RPC `list_public_lost_pets` /
 * `list_public_adoption_pets` / `list_public_org_pets`, ya cacheadas en
 * `publicCache.ts`) a las props de las tarjetas ya existentes (`PetCard`,
 * `AdoptionCard`). Un solo lugar para que el Landing y el inicio de los
 * paneles (usuario/admin) muestren exactamente la misma información pública,
 * con el mismo criterio de privacidad — nada de esto vuelve a consultar
 * Supabase ni expone datos que la RPC ya no exponga.
 */

const KIND_LABEL: Record<string, string> = { veterinaria: "Veterinaria", fundacion: "Fundación" };

export function speciesText(species: string, other: string | null): string {
  if (species === "other") return other || "Otro";
  return speciesLabels[species as keyof typeof speciesLabels] ?? "Mascota";
}

/** "hace 3 h" / "hace 2 días" — se recalcula en cada render, no se cachea el texto. */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "hace un momento";
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hace 1 día";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

export function toLostPetCard(row: PublicLostPetWithPhoto): LostPetCardData {
  return {
    publicId: row.publicId,
    name: row.name,
    typeLabel: speciesText(row.species, row.speciesOther),
    breed: row.breed,
    age:
      row.ageValue != null && row.ageUnit
        ? `${row.ageValue} ${ageUnitLabels[row.ageUnit].toLowerCase()}`
        : null,
    sex: row.sex ? sexLabels[row.sex] : null,
    location: [row.city, row.neighborhood].filter(Boolean).join(" · "),
    reportedAgo: timeAgo(row.reportedAt),
    photoPath: row.photoPath,
  };
}

export function toAdoptionItems(
  userPets: PublicAdoptionPet[],
  orgPets: PublicOrgPet[],
): AdoptionItem[] {
  return [
    ...userPets.map((pet): AdoptionItem => {
      const meta = [
        speciesText(pet.species, pet.speciesOther),
        pet.breed,
        pet.ageValue != null && pet.ageUnit
          ? `${pet.ageValue} ${ageUnitLabels[pet.ageUnit].toLowerCase()}`
          : null,
        pet.sex ? sexLabels[pet.sex] : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        key: `u-${pet.publicId}`,
        name: pet.name,
        photoPath: pet.photoPath,
        meta,
        city: null,
        badge: "adopcion",
        org: null,
        href: `/m/${pet.publicId}`,
        hrefLabel: "Ver mascota",
        external: false,
      };
    }),
    ...orgPets
      .filter((pet) => pet.needsHome)
      .map((pet): AdoptionItem => {
        const wa = whatsappLink(pet.org.whatsapp ?? "");
        return {
          key: `o-${pet.id}`,
          name: pet.name,
          photoPath: pet.photoPath,
          meta: [speciesText(pet.species, pet.speciesOther), pet.breed, pet.age].filter(Boolean).join(" · "),
          city: pet.org.city,
          badge: "adopcion",
          org: {
            name: pet.org.name,
            kindLabel: KIND_LABEL[pet.org.kind] ?? "Organización",
            logoUrl: pet.org.logoUrl,
          },
          href: wa || null,
          hrefLabel: wa ? `Escribir a ${pet.org.name}` : "Contacto en la organización",
          external: Boolean(wa),
        };
      }),
  ];
}
