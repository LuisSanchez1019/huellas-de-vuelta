import SectionTitle from "./SectionTitle";
import AutoScroller from "./AutoScroller";
import VeterinaryCard from "./VeterinaryCard";
import { mockFoundations, mockVeterinaries } from "@/data/mock";
import styles from "./landing.module.css";

function partnerInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export default function PartnersSection() {
  return (
    <section id="aliados" className={`${styles.section} ${styles.sectionAlt}`} aria-label="Fundaciones y veterinarias aliadas">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Red de aliados"
          title="Fundaciones aliadas"
          subtitle="Organizaciones verificadas que ayudan a atender, rehabilitar y proteger mascotas en todo el país."
        />
        <AutoScroller ariaLabel="Fundaciones aliadas">
          {mockFoundations.map((partner) => (
            <div key={partner.id} className={styles.partnerItem} role="listitem">
              <div className={styles.partnerLogo} aria-hidden="true">{partnerInitials(partner.name)}</div>
              <p className={styles.partnerName}>{partner.name}</p>
              <p className={styles.partnerKind}>{partner.kind}</p>
            </div>
          ))}
        </AutoScroller>

        <div className={styles.subsectionGap}>
          <SectionTitle
            eyebrow="Atención veterinaria"
            title="Veterinarias aliadas"
            subtitle="Clínicas que colaboran con atención prioritaria para mascotas encontradas y en proceso de reencuentro."
          />
          <AutoScroller ariaLabel="Veterinarias aliadas">
            {mockVeterinaries.map((vet) => (
              <VeterinaryCard key={vet.id} vet={vet} />
            ))}
          </AutoScroller>
        </div>
      </div>
    </section>
  );
}
