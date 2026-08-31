import Link from "next/link";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero} aria-label="Presentación">
      <div className={styles.inner}>
        <span className={styles.eyebrow}>Red de ayuda para mascotas · Colombia</span>
        <h1 className={styles.title}>Cada huella merece volver a casa.</h1>
        <p className={styles.description}>
          Reporta mascotas perdidas o encontradas, conecta con veterinarias y fundaciones aliadas, y ayuda a que más familias se reencuentren con sus mascotas — de forma gratuita y segura.
        </p>
        <div className={styles.ctaRow}>
          <Link className={styles.ctaPrimary} href="/auth?mode=sign-up">Reportar mascota perdida</Link>
          <Link className={styles.ctaSecondary} href="#mascotas">Ver mascotas encontradas</Link>
        </div>
        <div className={styles.trustRow}>
          <span className={styles.trustItem}><span className={styles.trustDot} />100% gratuito</span>
          <span className={styles.trustItem}><span className={styles.trustDot} />Perfiles verificados</span>
          <span className={styles.trustItem}><span className={styles.trustDot} />Datos protegidos</span>
        </div>
      </div>
    </section>
  );
}
