import Link from "next/link";
import styles from "./page.module.css";

export default function ScannedPetProfileDemo() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <Link className={styles.back} href="/">← Volver al inicio</Link>

        <div className={styles.previewBanner}>
          <span className={styles.previewIcon} aria-hidden="true">🔍</span>
          Vista previa · QR escaneado — así se verá esta página cuando escanees la placa real de una mascota.
        </div>

        <div className={styles.card}>
          <img
            className={styles.photo}
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Labrador_on_Quantock_%282175262184%29.jpg/960px-Labrador_on_Quantock_%282175262184%29.jpg"
            alt="Luna, una labrador color chocolate"
            loading="eager"
          />
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
              🔒 Los datos del propietario están protegidos. Al contactar, tu mensaje se envía de forma segura sin mostrar su número ni su dirección.
            </p>

            <Link className={styles.contactCta} href="/auth?mode=sign-up">Contactar al propietario de forma segura</Link>

            <p className={styles.photoCredit}>
              Foto ilustrativa · IDS.photos ·{" "}
              <a href="https://creativecommons.org/licenses/by-sa/2.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 2.0</a>
            </p>
          </div>
        </div>

        <p className={styles.explainer}>
          <strong>Esta es una página de ejemplo.</strong> Cuando registres a tu mascota y generemos su código QR único, escanear su placa llevará a una página como esta con su información real y verificada.
        </p>
      </div>
    </main>
  );
}
