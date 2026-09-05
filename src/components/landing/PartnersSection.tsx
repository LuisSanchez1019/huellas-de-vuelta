import { getCachedPartnerOrgs } from "@/lib/supabase/publicCache";
import type { OrgProfileKind } from "@/lib/supabase/orgProfiles";
import SectionTitle from "./SectionTitle";
import AutoScroller from "./AutoScroller";
import OrgCard, { type OrgCardData } from "./OrgCard";
import styles from "./landing.module.css";

function OrgSubsection({
  cards,
  eyebrow,
  title,
  subtitle,
  emptyText,
  ariaLabel,
}: {
  cards: OrgCardData[];
  eyebrow: string;
  title: string;
  subtitle: string;
  emptyText: string;
  ariaLabel: string;
}) {
  return (
    <div className={styles.subsectionGap}>
      <SectionTitle eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {cards.length === 0 ? (
        <p className={styles.scrollerEmpty}>{emptyText}</p>
      ) : (
        <AutoScroller ariaLabel={ariaLabel}>
          {cards.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </AutoScroller>
      )}
    </div>
  );
}

async function safeOrgs(kind: OrgProfileKind): Promise<OrgCardData[]> {
  try {
    return await getCachedPartnerOrgs(kind);
  } catch {
    return [];
  }
}

/**
 * Server component: las organizaciones aprobadas+activas se traen cacheadas
 * (ver `publicCache.ts`) — una sola consulta compartida entre visitantes por
 * la ventana de caché, en vez de que cada navegador la repita al cargar el
 * Landing.
 */
export default async function PartnersSection() {
  const [veterinarias, fundaciones] = await Promise.all([
    safeOrgs("veterinaria"),
    safeOrgs("fundacion"),
  ]);

  return (
    <section id="aliados" className={`${styles.section} ${styles.sectionAlt}`} aria-label="Fundaciones y veterinarias aliadas">
      <div className={styles.sectionInner}>
        <OrgSubsection
          cards={veterinarias}
          eyebrow="Atención veterinaria"
          title="Veterinarias aliadas"
          subtitle="Clínicas verificadas por Huellas de Vuelta que colaboran con la atención de mascotas encontradas y en proceso de reencuentro."
          emptyText="Aún no hay veterinarias aliadas verificadas."
          ariaLabel="Veterinarias aliadas"
        />
        <OrgSubsection
          cards={fundaciones}
          eyebrow="Red de aliados"
          title="Fundaciones aliadas"
          subtitle="Organizaciones verificadas que ayudan a atender, rehabilitar y proteger mascotas."
          emptyText="Aún no hay fundaciones aliadas verificadas."
          ariaLabel="Fundaciones aliadas"
        />
      </div>
    </section>
  );
}
