import Link from "next/link";
import { QrIcon } from "@/components/icons/Icon";
import styles from "./landing.module.css";

const steps = [
  { n: 1, title: "Registra a tu mascota", text: "Crea su perfil digital con fotos y su código QR único." },
  { n: 2, title: "Repórtala si se pierde", text: "Publica el caso en segundos y avisa a la comunidad." },
  { n: 3, title: "La comunidad ayuda", text: "Vecinos, veterinarias y fundaciones colaboran para encontrarla." },
  { n: 4, title: "Reencuentro seguro", text: "Coordina la entrega sin exponer tus datos personales." },
];

export default function InfoSection() {
  return (
    <section id="como-funciona" className={`${styles.section} ${styles.sectionAlt}`} aria-label="Cómo funciona">
      <div className={styles.sectionInner}>
        <div className={styles.infoLayout}>
          <div>
            <p className={styles.eyebrow}>Cómo funciona</p>
            <h2 className={styles.sectionTitleText}>Del registro al reencuentro</h2>
            <p className={styles.sectionSubtitle}>
              Así acompaña Huellas de Vuelta cada caso, de principio a fin.
            </p>
            <ol className={styles.infoSteps}>
              {steps.map((step) => (
                <li key={step.n} className={styles.infoStep}>
                  <span className={styles.infoStepNumber}>{step.n}</span>
                  <span>
                    <span className={styles.infoStepTitle}>{step.title}</span>
                    <span className={styles.infoStepText}>{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <aside className={styles.qrCallout}>
            <span className={styles.qrCalloutIcon} aria-hidden="true"><QrIcon size={26} /></span>
            <p className={styles.qrCalloutTitle}>Una placa QR que protege a tu mascota y tus datos</p>
            <p className={styles.qrCalloutText}>
              Cada mascota registrada obtiene un perfil con su propio código QR. Quien la encuentre
              puede contactarte al instante, sin que tu número o dirección queden expuestos.
            </p>
            <div className={styles.qrCalloutActions}>
              <Link className={styles.qrCalloutCta} href="/auth?mode=sign-up">Registrar mi mascota</Link>
              <Link className={styles.qrCalloutLink} href="/mascota/demo">Ver ejemplo</Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
