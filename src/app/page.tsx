import Link from "next/link";
import styles from "./page.module.css";

const foundationItems = ["Next.js + TypeScript", "Estructura preparada para Supabase", "Documentación y control de versiones"];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="page-title">
        <div className={styles.brand}><span className={styles.paw} aria-hidden="true">✦</span><span>Huellas de Vuelta</span></div>
        <p className={styles.eyebrow}>V0.1 · Base de desarrollo</p>
        <h1 id="page-title">Cada huella merece volver a casa.</h1>
        <p className={styles.description}>La base técnica de la plataforma ya está lista. El siguiente paso es conectar una autenticación segura y el registro inicial de mascotas.</p>
        <Link className={styles.authLink} href="/auth">Crear cuenta o iniciar sesión</Link>
      </section>
      <section className={styles.foundation} aria-labelledby="foundation-title">
        <p className={styles.sectionLabel}>Estado del proyecto</p><h2 id="foundation-title">Fundamentos preparados</h2>
        <ul>{foundationItems.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </main>
  );
}
