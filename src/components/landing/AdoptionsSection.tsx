import { getCachedAdoptionPets, getCachedOrgPets } from "@/lib/supabase/publicCache";
import { ageUnitLabels, sexLabels, speciesLabels } from "@/lib/pets/labels";
import { whatsappLink } from "@/lib/phone";
import SectionTitle from "./SectionTitle";
import CardSlider from "./CardSlider";
import AdoptionCard, { type AdoptionItem } from "./AdoptionCard";
import styles from "./landing.module.css";

const KIND_LABEL: Record<string, string> = { veterinaria: "Veterinaria", fundacion: "Fundación" };

function speciesText(species: string, other: string | null): string {
  if (species === "other") return other || "Otro";
  return speciesLabels[species as keyof typeof speciesLabels] ?? "Mascota";
}

/**
 * Server component: "En adopción". Une DOS fuentes reales:
 *  - mascotas de personas con estado `for_adoption` (RPC `list_public_adoption_pets`)
 *  - mascotas de organizaciones marcadas `needs_home` (RPC `list_public_org_pets`)
 * En las de organización se muestra qué fundación/veterinaria las tiene.
 * Sin mocks: si no hay ninguna, se muestra un estado vacío.
 */
export default async function AdoptionsSection() {
  const [userPets, orgPets] = await Promise.all([
    getCachedAdoptionPets().catch(() => []),
    getCachedOrgPets().catch(() => []),
  ]);

  const items: AdoptionItem[] = [
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
        photoUrl: pet.photoUrl,
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
          photoUrl: pet.photoUrl,
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

  return (
    <section id="adopciones" className={styles.section} aria-label="Mascotas en adopción">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Adopción responsable"
          title="En adopción"
          subtitle="Mascotas reales que buscan un nuevo hogar, publicadas por sus familias y por organizaciones aliadas."
        />
        {items.length === 0 ? (
          <p className={styles.scrollerEmpty}>Todavía no hay mascotas publicadas para adopción.</p>
        ) : (
          <CardSlider ariaLabel="Mascotas en adopción">
            {items.map((item) => (
              <AdoptionCard key={item.key} item={item} />
            ))}
          </CardSlider>
        )}
      </div>
    </section>
  );
}
