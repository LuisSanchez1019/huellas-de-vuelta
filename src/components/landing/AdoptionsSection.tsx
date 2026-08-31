import SectionTitle from "./SectionTitle";
import HorizontalScroller from "./HorizontalScroller";
import AdoptionCard from "./AdoptionCard";
import { mockAdoptions } from "@/data/mock";
import styles from "./landing.module.css";

export default function AdoptionsSection() {
  return (
    <section id="adopciones" className={styles.section} aria-label="Adopciones destacadas">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Adopción responsable"
          title="Adopciones destacadas"
          subtitle="Mascotas que ya pasaron por evaluación y esperan un hogar responsable."
        />
        <HorizontalScroller ariaLabel="Adopciones destacadas">
          {mockAdoptions.map((pet) => (
            <AdoptionCard key={pet.id} pet={pet} />
          ))}
        </HorizontalScroller>
      </div>
    </section>
  );
}
