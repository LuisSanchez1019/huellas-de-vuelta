import SectionTitle from "./SectionTitle";
import HorizontalScroller from "./HorizontalScroller";
import PetCard from "./PetCard";
import { mockPets } from "@/data/mock";
import styles from "./landing.module.css";

export default function HelpSection() {
  return (
    <section id="mascotas" className={styles.section} aria-label="Mascotas que necesitan ayuda">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Comunidad activa"
          title="Mascotas que necesitan ayuda"
          subtitle="Casos recientes de mascotas perdidas y encontradas cerca de ti. Compártelas o repórtalas para acelerar el reencuentro."
        />
        <HorizontalScroller ariaLabel="Mascotas que necesitan ayuda">
          {mockPets.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
        </HorizontalScroller>
      </div>
    </section>
  );
}
