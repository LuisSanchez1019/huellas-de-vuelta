import { PinIcon } from "@/components/icons/Icon";
import LandingOrgMap from "./LandingOrgMap";
import styles from "./landing.module.css";

const mapHighlights = [
  "Veterinarias y fundaciones aliadas verificadas por Huellas de Vuelta",
  "Ubicación real de cada organización, con su información pública",
  "Filtra por tipo y abre cada punto para ver horario y contacto",
];

export default function MapSection() {
  return (
    <section id="mapa" className={styles.section} aria-label="Mapa de organizaciones aliadas">
      <div className={styles.sectionInner}>
        <div className={styles.mapIntro}>
          <p className={styles.eyebrow}>Cobertura local</p>
          <h2 className={styles.sectionTitleText}>Organizaciones aliadas en el mapa</h2>
          <p className={styles.sectionSubtitle}>
            Explora las veterinarias y fundaciones aprobadas que forman parte de Huellas de Vuelta.
            Son las mismas organizaciones que aparecen cuando alguien encuentra una mascota y busca
            ayuda cerca.
          </p>
          <div className={styles.mapHighlights}>
            {mapHighlights.map((item) => (
              <p key={item} className={styles.mapHighlight}>
                <PinIcon size={16} className={styles.inlineIcon} />
                {item}
              </p>
            ))}
          </div>
        </div>

        <LandingOrgMap />
      </div>
    </section>
  );
}
