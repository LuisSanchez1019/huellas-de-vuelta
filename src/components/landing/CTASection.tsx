import Link from "next/link";
import { PawIcon } from "@/components/icons/Icon";
import styles from "./landing.module.css";

export default function CTASection() {
  return (
    <section className={styles.orgCtaSection} aria-label="Únete como organización">
      <div className={styles.orgCtaInner}>
        <div className={styles.orgCtaCopy}>
          <p className={styles.orgCtaTitle}>¿Eres una veterinaria o fundación?</p>
          <p className={styles.orgCtaText}>
            Únete a Huellas de Vuelta y sé parte del cambio. Recibe mascotas encontradas, aparece en
            el mapa y ayuda a que más familias se reencuentren.
          </p>
          <Link className={styles.orgCtaButton} href="/auth?mode=sign-up">Registra tu organización</Link>
        </div>
        <div className={styles.orgCtaVisual} aria-hidden="true">
          <span className={styles.orgCtaBadge}>Más aliados, más vidas salvadas</span>
          <span className={styles.orgCtaPaw}><PawIcon size={64} /></span>
        </div>
      </div>
    </section>
  );
}
