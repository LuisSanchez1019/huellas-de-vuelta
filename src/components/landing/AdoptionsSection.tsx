import { getCachedAdoptionPets, getCachedOrgPets } from "@/lib/supabase/publicCache";
import { toAdoptionItems } from "@/lib/pets/publicPetCards";
import SectionTitle from "./SectionTitle";
import CardSlider from "./CardSlider";
import AdoptionCard from "./AdoptionCard";
import styles from "./landing.module.css";

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

  const items = toAdoptionItems(userPets, orgPets);

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
