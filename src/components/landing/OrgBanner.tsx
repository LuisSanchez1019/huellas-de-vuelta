import styles from "./landing.module.css";

/**
 * Banner/imagen principal, inmediatamente debajo de la navegación. Usa el
 * asset SVG existente tal cual (`/public/landing/banner-organizaciones.svg`),
 * a todo el ancho disponible y sin deformarlo. La pieza ya trae su propio
 * texto de marca; el `<h1>` real (para SEO y accesibilidad) vive en la
 * sección Hero, justo debajo.
 */
export default function OrgBanner() {
  return (
    <section className={styles.orgBanner} aria-label="Huellas de Vuelta">
      {/* eslint-disable-next-line @next/next/no-img-element -- asset SVG estático servido desde /public */}
      <img
        src="/landing/banner-organizaciones.svg"
        alt="Cada mascota merece volver a casa. Pequeñas acciones, grandes reencuentros."
        className={styles.orgBannerImg}
        width={1380}
        height={468}
      />
    </section>
  );
}
