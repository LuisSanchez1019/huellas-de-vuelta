import { getCachedPartnerOrgs } from "@/lib/supabase/publicCache";
import type { OrgProfileKind } from "@/lib/supabase/orgProfiles";
import SectionTitle from "./SectionTitle";
import CardSlider from "./CardSlider";
import OrgCard from "./OrgCard";
import styles from "./landing.module.css";

interface Config {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  empty: string;
  aria: string;
}

const CONFIG: Record<OrgProfileKind, Config> = {
  veterinaria: {
    id: "veterinarias",
    eyebrow: "Atención veterinaria",
    title: "Veterinarias",
    subtitle:
      "Clínicas verificadas por Huellas de Vuelta que colaboran con la atención de mascotas encontradas y en proceso de reencuentro.",
    empty: "Aún no hay veterinarias aliadas verificadas.",
    aria: "Veterinarias aliadas",
  },
  fundacion: {
    id: "fundaciones",
    eyebrow: "Rescate y bienestar",
    title: "Fundaciones",
    subtitle:
      "Organizaciones verificadas que trabajan en el rescate, la rehabilitación y la adopción responsable de mascotas.",
    empty: "Aún no hay fundaciones aliadas verificadas.",
    aria: "Fundaciones aliadas",
  },
};

/**
 * Server component reutilizable para las secciones de "Veterinarias" y
 * "Fundaciones" — son secciones INDEPENDIENTES (no se mezclan). Consumen la
 * misma RPC cacheada `getCachedPartnerOrgs(kind)`: solo organizaciones
 * publicadas + aprobadas + activas del tipo indicado.
 */
export default async function OrgsSection({ kind }: { kind: OrgProfileKind }) {
  const cfg = CONFIG[kind];
  const orgs = await getCachedPartnerOrgs(kind).catch(() => []);

  return (
    <section id={cfg.id} className={styles.section} aria-label={cfg.aria}>
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow={cfg.eyebrow}
          title={cfg.title}
          subtitle={cfg.subtitle}
          viewAllHref="/#mapa"
          viewAllLabel="Ver en el mapa"
        />
        {orgs.length === 0 ? (
          <p className={styles.scrollerEmpty}>{cfg.empty}</p>
        ) : (
          <CardSlider ariaLabel={cfg.aria}>
            {orgs.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
          </CardSlider>
        )}
      </div>
    </section>
  );
}
