import SectionTitle from "./SectionTitle";
import LostPetsScroller from "./LostPetsScroller";
import styles from "./landing.module.css";

export default function HelpSection() {
  return (
    <section id="mascotas" className={styles.section} aria-label="Mascotas que necesitan ayuda">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Comunidad activa"
          title="Mascotas que necesitan ayuda"
          subtitle="Casos recientes de mascotas perdidas reportadas por sus familias. Compártelas para acelerar el reencuentro."
        />
        <LostPetsScroller />
      </div>
    </section>
  );
}
