import Link from "next/link";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero} aria-label="Presentación">
      <div className={styles.inner}>
        <div>
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

        <div className={styles.visual}>
          <div className={styles.card}>
            <img
              className={styles.photo}
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Labrador_on_Quantock_%282175262184%29.jpg/960px-Labrador_on_Quantock_%282175262184%29.jpg"
              alt="Luna, una labrador color chocolate"
              loading="eager"
            />
            <p className={styles.cardName}>Luna</p>
            <p className={styles.cardMeta}>Labrador · Bucaramanga</p>
            <p className={styles.photoCredit}>
              Foto ilustrativa · IDS.photos ·{" "}
              <a href="https://creativecommons.org/licenses/by-sa/2.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 2.0</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
