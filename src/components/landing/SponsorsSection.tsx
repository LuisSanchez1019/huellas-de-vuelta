import Link from "next/link";
import { HandIcon } from "@/components/icons/Icon";
import SectionTitle from "./SectionTitle";
import styles from "./landing.module.css";

/**
 * "Empresas que apoyan la causa" — sección COMERCIAL, distinta de Veterinarias
 * y Fundaciones y del mapa. Está pensada para futuros patrocinadores.
 *
 * Todavía NO existe una tabla/estructura real de patrocinadores, así que aquí
 * NO se inventan empresas: se muestra un estado vacío elegante y el componente
 * queda preparado para conectar más adelante una fuente real
 * (p. ej. una tabla `sponsors` con logo, nombre, categoría, descripción y
 * enlace externo). No hay pagos ni suscripciones.
 */
export default function SponsorsSection() {
  return (
    <section id="empresas" className={`${styles.section} ${styles.sectionAlt}`} aria-label="Empresas que apoyan la causa">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Aliados comerciales"
          title="Empresas que apoyan la causa"
          subtitle="Gracias a nuestros aliados podemos seguir trabajando para ayudar a más mascotas."
        />
        <div className={styles.sponsorsEmpty}>
          <span className={styles.sponsorsEmptyIcon} aria-hidden="true"><HandIcon size={26} /></span>
          <p className={styles.sponsorsEmptyTitle}>Este espacio es para las empresas que apoyan a Huellas de Vuelta</p>
          <p className={styles.sponsorsEmptyText}>
            Aún no hay aliados comerciales publicados. Si tu empresa quiere apoyar la plataforma y
            aparecer aquí, únete como aliado.
          </p>
          <Link className={styles.sponsorsEmptyCta} href="/auth/aliado">Quiero ser aliado</Link>
        </div>
      </div>
    </section>
  );
}
