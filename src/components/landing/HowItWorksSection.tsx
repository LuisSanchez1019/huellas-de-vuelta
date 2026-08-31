import styles from "./landing.module.css";
import SectionTitle from "./SectionTitle";

const steps = [
  { title: "Registra a tu mascota", text: "Crea un perfil digital con fotos, características y su código QR único." },
  { title: "Repórtala si se pierde", text: "Publica el caso en segundos y notifica a la comunidad cercana." },
  { title: "La comunidad ayuda", text: "Veterinarias, fundaciones y vecinos colaboran para encontrarla." },
  { title: "Reencuentro seguro", text: "Verifica al propietario y coordina el reencuentro sin exponer datos personales." },
];

export default function HowItWorksSection() {
  return (
    <section id="como-funciona" className={`${styles.section} ${styles.sectionAlt}`} aria-label="Cómo funciona">
      <div className={styles.sectionInner}>
        <SectionTitle eyebrow="Proceso" title="¿Cómo funciona?" subtitle="Del registro al reencuentro, así acompaña Huellas de Vuelta cada caso." />
        <div className={styles.stepsGrid}>
          {steps.map((step, index) => (
            <div key={step.title} className={styles.stepItem}>
              <div className={styles.stepNumber}>{index + 1}</div>
              <p className={styles.stepTitle}>{step.title}</p>
              <p className={styles.stepText}>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
