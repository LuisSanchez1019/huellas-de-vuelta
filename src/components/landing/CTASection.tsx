import styles from "./landing.module.css";

/**
 * Cierre del Landing: solo la ilustración `hero-reencuentros.svg`, centrada en
 * su sección. El SVG trae mucho margen transparente arriba/abajo del banner
 * visible, así que se recorta con `aspect-ratio` + `object-fit: cover` para que
 * la pieza se vea equilibrada y sin deformar (width 100% / height auto sobre el
 * original) en desktop, tablet y móvil. Sin botón: el registro de organización
 * está en el Hero y en el footer.
 */
export default function CTASection() {
  return (
    <section className={styles.reencuentroSection} aria-label="Pequeñas acciones, grandes reencuentros">
      <div className={styles.reencuentroInner}>
        <div className={styles.reencuentroMedia}>
          {/* eslint-disable-next-line @next/next/no-img-element -- asset SVG estático servido desde /public */}
          <img
            src="/landing/hero-reencuentros.svg"
            alt="¿Eres una veterinaria o fundación? Únete a Huellas de Vuelta y sé parte del cambio."
            className={styles.reencuentroImg}
            width={1056}
            height={360}
          />
        </div>
      </div>
    </section>
  );
}
