import Image from "next/image";
import Link from "next/link";
import { CheckIcon } from "@/components/icons/Icon";
import ThemeToggle from "@/components/theme/ThemeToggle";
import OrgTypeChoice from "@/components/auth/OrgTypeChoice";
import styles from "../page.module.css";

export default function VetFunChooserPage() {
  return (
    <main className={styles.page}>
      <div className={styles.themeSlot}>
        <ThemeToggle />
      </div>

      <div className={styles.shell}>
        <aside className={styles.brandPanel}>
          <Link className={styles.brandBack} href="/">← Volver al inicio</Link>
          <div className={styles.brandMain}>
            <Image className={styles.brandLogo} src="/logo-emblem-hdv.png" alt="Huellas de Vuelta" width={2000} height={2000} priority />
            <p className={styles.brandName}>Huellas de Vuelta</p>
            <p className={styles.brandTagline}>Ayudamos a que cada mascota vuelva a casa.</p>
            <ul className={styles.brandPoints}>
              <li><CheckIcon size={18} /> Cada tipo de organización tiene su propio acceso.</li>
              <li><CheckIcon size={18} /> Tu rol se valida de forma segura al iniciar sesión.</li>
              <li><CheckIcon size={18} /> Un correo, una cuenta, una organización.</li>
            </ul>
          </div>
          <p className={styles.brandFoot}>Acceso seguro · Tus datos están protegidos.</p>
        </aside>

        <section className={styles.card} aria-labelledby="auth-title">
          <p className={styles.eyebrow}>Organizaciones aliadas</p>
          <h1 id="auth-title">¿Cómo deseas ingresar?</h1>
          <p className={styles.description}>Elige el tipo de organización para continuar.</p>
          <div style={{ marginTop: "1.5rem" }}>
            <OrgTypeChoice />
          </div>
        </section>
      </div>
    </main>
  );
}
