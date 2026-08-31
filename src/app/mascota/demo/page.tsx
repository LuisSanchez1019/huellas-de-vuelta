import Link from "next/link";
import { LockIcon, PawIcon, SearchIcon } from "@/components/icons/Icon";
import styles from "./page.module.css";

export default function ScannedPetProfileDemo() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <Link className={styles.back} href="/">← Volver al inicio</Link>

        <div className={styles.previewBanner}>
          <SearchIcon size={18} className={styles.previewIcon} />
          Vista previa · QR escaneado — así se verá esta página cuando escanees la placa real de una mascota.
        </div>

        <div className={styles.card}>
          <div className={styles.photo} aria-hidden="true">
            <PawIcon size={56} className={styles.photoIcon} />
          </div>
          <div className={styles.body}>
            <div className={styles.badgeRow}>
              <span className={styles.badge}>Perdida</span>
            </div>
            <p className={styles.name}>Luna</p>
            <p className={styles.meta}>Labrador · Bucaramanga</p>

            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Última ubicación conocida</span>
                <span className={styles.detailValue}>Cerca al Parque San Pío, Bucaramanga</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Reportada</span>
                <span className={styles.detailValue}>Hace 2 días</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Color</span>
                <span className={styles.detailValue}>Chocolate</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Código de placa</span>
                <span className={styles.detailValue}>HDV-DEMO-001</span>
              </div>
            </div>

            <p className={styles.privacyNote}>
              <LockIcon size={16} className={styles.inlineIcon} />
              Los datos del propietario están protegidos. Al contactar, tu mensaje se envía de forma segura sin mostrar su número ni su dirección.
            </p>

            <Link className={styles.contactCta} href="/auth?mode=sign-up">Contactar al propietario de forma segura</Link>
          </div>
        </div>

        <p className={styles.explainer}>
          <strong>Esta es una página de ejemplo.</strong> Cuando registres a tu mascota y generemos su código QR único, escanear su placa llevará a una página como esta con su información real y verificada.
        </p>
      </div>
    </main>
  );
}
