import Link from "next/link";
import styles from "./landing.module.css";

export default function CTASection() {
  return (
    <section className={styles.ctaSection} aria-label="Únete a la red">
      <div className={styles.ctaInner}>
        <div>
          <p className={styles.ctaTitle}>Ayudemos juntos a que más mascotas vuelvan a casa</p>
          <p className={styles.ctaText}>Únete gratis a Huellas de Vuelta: reporta, comparte y ayuda a construir una red de apoyo para mascotas en toda Colombia.</p>
        </div>
        <div className={styles.ctaButtons}>
          <Link className={styles.ctaPrimary} href="/auth?mode=sign-up">Regístrate gratis</Link>
          <Link className={styles.ctaSecondary} href="#como-funciona">Conoce cómo funciona</Link>
        </div>
      </div>
    </section>
  );
}
