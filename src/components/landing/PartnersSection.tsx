import Link from "next/link";
import { getCachedPartnerOrgs } from "@/lib/supabase/publicCache";
import AutoScroller from "./AutoScroller";
import OrgCard, { type OrgCardData } from "./OrgCard";
import styles from "./landing.module.css";

/**
 * Server component: "Aliados destacados". Reúne las veterinarias y fundaciones
 * APROBADAS + ACTIVAS (mismas RPC cacheadas del resto del Landing) en una sola
 * tira. No hay anunciantes ficticios: todo lo que aparece es una organización
 * real que pasó la aprobación del administrador. El destacado (`featured`)
 * queda preparado para cuando exista una columna de patrocinio en la base de
 * datos; hoy ninguna organización lo activa.
 */
export default async function PartnersSection() {
  const [veterinarias, fundaciones] = await Promise.all([
    getCachedPartnerOrgs("veterinaria").catch(() => []),
    getCachedPartnerOrgs("fundacion").catch(() => []),
  ]);

  // Intercala veterinarias y fundaciones para que la tira no quede agrupada.
  const merged: OrgCardData[] = [];
  const max = Math.max(veterinarias.length, fundaciones.length);
  for (let i = 0; i < max; i += 1) {
    if (veterinarias[i]) merged.push(veterinarias[i]);
    if (fundaciones[i]) merged.push(fundaciones[i]);
  }

  return (
    <section id="aliados" className={`${styles.section} ${styles.sectionAlt}`} aria-label="Aliados destacados">
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>
              Aliados destacados <span className={styles.adTag}>Publicidad</span>
            </p>
            <h2 className={styles.sectionTitleText}>Organizaciones y negocios que apoyan esta causa</h2>
            <p className={styles.sectionSubtitle}>
              Veterinarias y fundaciones verificadas por Huellas de Vuelta. Son las mismas
              organizaciones que aparecen cuando alguien encuentra una mascota y busca ayuda cerca.
            </p>
          </div>
          <Link className={styles.viewAllLink} href="/#mapa">Ver todos los aliados →</Link>
        </div>

        {merged.length === 0 ? (
          <p className={styles.scrollerEmpty}>Aún no hay organizaciones aliadas verificadas.</p>
        ) : (
          <AutoScroller ariaLabel="Aliados destacados">
            {merged.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
          </AutoScroller>
        )}
      </div>
    </section>
  );
}
