import { getCachedMapOrganizations } from "@/lib/supabase/publicCache";
import LandingOrgMap from "./LandingOrgMap";
import styles from "./landing.module.css";

/**
 * Server component: trae los marcadores del mapa (RPC pública, cacheada —
 * ver `publicCache.ts`) UNA vez por ventana de caché, compartida entre todos
 * los visitantes. El mapa (Leaflet) sigue montándose solo en cliente y solo
 * cerca del viewport (`LandingOrgMap`).
 *
 * Las instrucciones de uso ya NO viven en un panel grande al lado del mapa:
 * son una cabecera compacta encima de los filtros, dentro de `OrgMapInner`.
 * El mapa muestra exactamente las organizaciones de las secciones Veterinarias
 * y Fundaciones (misma RPC de fondo: publicadas + aprobadas + activas + con
 * coordenadas válidas).
 */
export default async function MapSection() {
  const orgs = await getCachedMapOrganizations().catch(() => []);

  return (
    <section id="mapa" className={`${styles.section} ${styles.sectionAlt}`} aria-label="Mapa de organizaciones aliadas">
      <div className={styles.sectionInner}>
        <p className={styles.eyebrow}>Cobertura local</p>
        <h2 className={styles.sectionTitleText}>Encuentra ayuda cerca de ti</h2>
        <p className={styles.sectionSubtitle}>
          Veterinarias y fundaciones verificadas por Huellas de Vuelta, con su ubicación real y su
          información de contacto.
        </p>
        <LandingOrgMap orgs={orgs} />
      </div>
    </section>
  );
}
