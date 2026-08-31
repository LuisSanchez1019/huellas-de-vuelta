import Link from "next/link";
import styles from "./landing.module.css";

const flowSteps = [
  "Escanea la placa QR de la mascota",
  "Contacta al propietario sin ver sus datos personales",
  "Coordinen el reencuentro de forma segura",
];

export default function QRSection() {
  return (
    <section className={styles.section} aria-label="Placa QR de identificación">
      <div className={`${styles.sectionInner} ${styles.qrSection}`}>
        <div>
          <p className={styles.qrCopyEyebrow}>Identificación inteligente</p>
          <h2 className={styles.qrTitle}>Una placa QR que protege a tu mascota y tus datos</h2>
          <p className={styles.qrText}>
            Cada mascota registrada obtiene un perfil digital con su propio código QR. Quien la encuentre puede escanearlo y contactarte de inmediato, sin que tu número o dirección queden expuestos.
          </p>
          <div className={styles.qrFlow}>
            {flowSteps.map((step, index) => (
              <p key={step} className={styles.qrFlowStep}>
                <span className={styles.qrFlowDot}>{index + 1}</span>
                {step}
              </p>
            ))}
          </div>
          <div className={styles.qrCtaRow}>
            <Link className={styles.qrCta} href="/auth?mode=sign-up">Registrar mi mascota</Link>
            <Link className={styles.qrCtaSecondary} href="/mascota/demo">Ver QR escaneado (ejemplo)</Link>
          </div>
        </div>

        <div className={styles.qrVisual}>
          <Link className={styles.qrVisualLink} href="/mascota/demo" aria-label="Ver ejemplo de página al escanear una placa QR">
            <div className={styles.qrBadge}>
              <p className={styles.qrBadgeBrand}>Huellas de Vuelta</p>
              <div className={styles.qrBadgeGrid} aria-hidden="true" />
              <p className={styles.qrBadgeCaption}>Escanea para contactar al propietario de forma segura</p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
