import { getCachedOrgPets } from "@/lib/supabase/publicCache";
import { speciesLabels } from "@/lib/pets/labels";
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
 * Server component: "Apadrina una mascota". Mascotas de organizaciones
 * marcadas `needs_sponsor` (RPC `list_public_org_pets`). Solo datos reales:
 * la estructura del apadrinamiento (marcar la mascota como "busca padrino")
 * ya existe en `organization_pets`. Todavía NO hay sistema de pagos: la
 * tarjeta solo muestra la mascota y su organización responsable, con un
 * contacto directo por WhatsApp. Si no hay ninguna, estado vacío.
 */
export default async function SponsorPetsSection() {
  const orgPets = await getCachedOrgPets().catch(() => []);

  const items: AdoptionItem[] = orgPets
    .filter((pet) => pet.needsSponsor)
    .map((pet): AdoptionItem => {
      const wa = whatsappLink(pet.org.whatsapp ?? "");
      return {
        key: `s-${pet.id}`,
        name: pet.name,
        photoUrl: pet.photoUrl,
        meta: [speciesText(pet.species, pet.speciesOther), pet.breed, pet.age].filter(Boolean).join(" · "),
        city: pet.org.city,
        badge: "padrino",
        org: {
          name: pet.org.name,
          kindLabel: KIND_LABEL[pet.org.kind] ?? "Organización",
          logoUrl: pet.org.logoUrl,
        },
        href: wa || null,
        hrefLabel: wa ? `Escribir a ${pet.org.name}` : "Contacto en la organización",
        external: Boolean(wa),
      };
    });

  return (
    <section id="apadrinamiento" className={`${styles.section} ${styles.sectionAlt}`} aria-label="Apadrina una mascota">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Apoyo continuo"
          title="Apadrina una mascota"
          subtitle="Mascotas al cuidado de fundaciones que necesitan un padrino para cubrir su alimentación y sus tratamientos."
        />
        {items.length === 0 ? (
          <p className={styles.scrollerEmpty}>
            Por ahora ninguna organización tiene mascotas buscando padrino. Cuando una fundación marque
            una mascota como &laquo;busca padrino&raquo;, aparecerá aquí.
          </p>
        ) : (
          <CardSlider ariaLabel="Mascotas que buscan padrino">
            {items.map((item) => (
              <AdoptionCard key={item.key} item={item} />
            ))}
          </CardSlider>
        )}
      </div>
    </section>
  );
}
