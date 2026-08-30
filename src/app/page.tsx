import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

const foundationItems = [
  "Next.js + TypeScript",
  "Autenticación y cuentas con Supabase",
  "Registro de mascotas con estado y datos básicos",
];

export default function Home() {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Image className={styles.logo} src="/logo.png" alt="Huellas de Vuelta" width={44} height={44} priority />
          <span>Huellas de Vuelta</span>
        </div>
        <nav className={styles.nav} aria-label="Principal">
          <Link className={styles.navLink} href="#estado">Estado del proyecto</Link>
          <Link className={styles.navCta} href="/auth">Ingreso</Link>
        </nav>
      </header>

      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="page-title">
          <p className={styles.eyebrow}>V0.1 · Base de desarrollo</p>
          <h1 id="page-title">Cada huella merece volver a casa.</h1>
          <p className={styles.description}>
            Huellas de Vuelta ayuda a reunir mascotas perdidas con sus familias, gestionar mascotas encontradas y facilitar adopciones responsables.
          </p>
          <Link className={styles.authLink} href="/auth">Crear cuenta o iniciar sesión</Link>
        </section>

        <section id="estado" className={styles.foundation} aria-labelledby="foundation-title">
          <p className={styles.sectionLabel}>Estado del proyecto</p>
          <h2 id="foundation-title">Fundamentos preparados</h2>
          <ul>
            {foundationItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className={styles.upcoming} aria-labelledby="upcoming-title">
          <p className={styles.sectionLabel}>Próximamente</p>
          <h2 id="upcoming-title">Noticias y actualizaciones</h2>
          <p className={styles.description}>
            Aquí compartiremos avances del proyecto, alianzas con veterinarias y fundaciones, y novedades de la comunidad.
          </p>
        </section>
      </main>
    </>
  );
}
