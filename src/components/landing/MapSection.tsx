import Link from "next/link";
import { MapIcon, PinIcon } from "@/components/icons/Icon";
import styles from "./landing.module.css";

const mapHighlights = [
  "Mascotas perdidas y encontradas reportadas cerca de ti",
  "Veterinarias y fundaciones aliadas por zona",
  "Filtros por estado del caso y fecha del reporte",
];

export default function MapSection() {
  return (
    <section id="mapa" className={styles.section} aria-label="Mapa de la comunidad">
      <div className={`${styles.sectionInner} ${styles.mapSection}`}>
        <div>
          <p className={styles.eyebrow}>Cobertura local</p>
          <h2 className={styles.sectionTitleText}>Explora lo que pasa cerca de ti en el mapa</h2>
          <p className={styles.sectionSubtitle}>
            El mapa interactivo reúne los casos activos y las organizaciones aliadas de tu zona para que puedas ayudar (o pedir ayuda) sin salir de tu barrio.
          </p>
          <div className={styles.mapHighlights}>
            {mapHighlights.map((item) => (
              <p key={item} className={styles.mapHighlight}>
                <PinIcon size={16} className={styles.inlineIcon} />
                {item}
              </p>
            ))}
          </div>
          <div className={styles.mapCtaRow}>
            <Link className={styles.qrCta} href="/mapa">Abrir el mapa</Link>
            <Link className={styles.qrCtaSecondary} href="/auth?mode=sign-up">Reportar una mascota</Link>
          </div>
        </div>

        <Link className={styles.mapVisual} href="/mapa" aria-label="Abrir el mapa de la comunidad">
          <div className={styles.mapCanvas} aria-hidden="true">
            <span className={`${styles.mapPin} ${styles.mapPinLost}`}><PinIcon size={18} /></span>
            <span className={`${styles.mapPin} ${styles.mapPinFound}`}><PinIcon size={18} /></span>
            <span className={`${styles.mapPin} ${styles.mapPinAlly}`}><PinIcon size={18} /></span>
          </div>
          <p className={styles.mapCanvasCaption}>
            <MapIcon size={18} className={styles.inlineIcon} />
            Vista previa · el mapa interactivo llega muy pronto
          </p>
        </Link>
      </div>
    </section>
  );
}
