import Link from "next/link";
import { MapIcon, PinIcon } from "@/components/icons/Icon";
import { getCachedMapOrganizations } from "@/lib/supabase/publicCache";
import LandingOrgMap from "./LandingOrgMap";
import styles from "./landing.module.css";

const mapHighlights = [
  "Veterinarias y fundaciones aliadas verificadas por Huellas de Vuelta",
  "Ubicación real de cada organización, con su información de contacto",
  "Filtra por tipo y abre cada punto para ver horario y servicios",
];

/**
 * Server component: trae los marcadores del mapa (RPC pública, cacheada —
 * ver `publicCache.ts`) UNA vez por ventana de caché, compartida entre todos
 * los visitantes. El mapa (Leaflet) sigue montándose solo en cliente y solo
 * cerca del viewport (`LandingOrgMap`).
 */
export default async function MapSection() {
  const orgs = await getCachedMapOrganizations().catch(() => []);

  return (
    <section id="mapa" className={styles.section} aria-label="Mapa de organizaciones aliadas">
      <div className={styles.sectionInner}>
        <div className={styles.mapLayout}>
          <div className={styles.mapMain}>
            <p className={styles.eyebrow}>Cobertura local</p>
            <h2 className={styles.sectionTitleText}>Encuentra ayuda cerca de ti</h2>
            <p className={styles.sectionSubtitle}>Veterinarias y fundaciones en tu ciudad.</p>
            <LandingOrgMap orgs={orgs} />
          </div>

          <aside className={styles.mapAside}>
            <span className={styles.mapAsideIcon} aria-hidden="true"><MapIcon size={26} /></span>
            <p className={styles.mapAsideTitle}>Explora el mapa</p>
            <p className={styles.mapAsideText}>
              Encuentra veterinarias y fundaciones cerca de ti. Obtén su información de contacto,
              horarios y servicios.
            </p>
            <ul className={styles.mapAsideList}>
              {mapHighlights.map((item) => (
                <li key={item}>
                  <PinIcon size={14} className={styles.inlineIcon} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/#mapa" className={styles.mapAsideCta}>Ver mapa completo</Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
