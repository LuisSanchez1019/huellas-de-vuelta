import { getCachedAdoptionPets } from "@/lib/supabase/publicCache";
import SectionTitle from "./SectionTitle";
import AutoScroller from "./AutoScroller";
import AdoptionCard from "./AdoptionCard";
import styles from "./landing.module.css";

/**
 * Server component: mascotas REALES en adopción (mismas mascotas del sistema
 * con estado `for_adoption`), cacheadas — se actualiza sola cuando una
 * mascota entra o sale de adopción. Si no hay ninguna, la sección no se
 * muestra para no dejar un hueco vacío en el Landing.
 */
export default async function AdoptionsSection() {
  const pets = await getCachedAdoptionPets().catch(() => []);
  if (pets.length === 0) return null;

  return (
    <section id="adopciones" className={styles.section} aria-label="Adopciones destacadas">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Adopción responsable"
          title="Adopciones destacadas"
          subtitle="Mascotas reales publicadas para adopción por sus familias u organizaciones aliadas."
        />
        <AutoScroller ariaLabel="Adopciones destacadas">
          {pets.map((pet) => (
            <AdoptionCard key={pet.publicId} pet={pet} />
          ))}
        </AutoScroller>
      </div>
    </section>
  );
}
