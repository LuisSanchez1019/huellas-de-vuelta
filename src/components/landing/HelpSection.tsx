import SectionTitle from "./SectionTitle";
import AutoScroller from "./AutoScroller";
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
        <AutoScroller ariaLabel="Mascotas que necesitan ayuda">
          {mockPets.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
        </AutoScroller>
      </div>
    </section>
  );
}
