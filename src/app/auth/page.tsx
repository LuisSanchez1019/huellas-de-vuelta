import Image from "next/image";
import Link from "next/link";
import { CheckIcon, HandIcon, IdCardIcon, UserIcon } from "@/components/icons/Icon";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "./page.module.css";

const options = [
  {
    href: "/auth/usuarios",
    icon: <UserIcon size={22} />,
    title: "Ingreso de usuarios",
    text: "Propietarios y usuarios de Huellas de Vuelta.",
  },
  {
    href: "/auth/vet-fun",
    icon: <IdCardIcon size={22} />,
    title: "Ingreso de veterinarias y fundaciones",
    text: "Organizaciones que ayudan a las mascotas de su comunidad.",
  },
  {
    href: "/auth/aliado",
    icon: <HandIcon size={22} />,
    title: "Ingreso de aliados",
    text: "Empresas y patrocinadores que apoyan la plataforma.",
  },
];

export default function AuthChooserPage() {
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
              <li><CheckIcon size={18} /> Cada tipo de cuenta tiene su propio acceso.</li>
              <li><CheckIcon size={18} /> Tu rol se valida de forma segura al iniciar sesión.</li>
              <li><CheckIcon size={18} /> Un correo, una cuenta.</li>
            </ul>
          </div>
          <p className={styles.brandFoot}>Acceso seguro · Tus datos están protegidos.</p>
        </aside>

        <section className={styles.card} aria-labelledby="auth-title">
          <p className={styles.eyebrow}>Acceso</p>
          <h1 id="auth-title">¿Cómo quieres ingresar?</h1>
          <p className={styles.description}>Elige el acceso que corresponde a tu tipo de cuenta.</p>

          <div className={styles.chooser}>
            {options.map((option) => (
              <Link key={option.href} href={option.href} className={styles.chooserCard}>
                <span className={styles.chooserIcon} aria-hidden="true">{option.icon}</span>
                <span className={styles.chooserBody}>
                  <span className={styles.chooserTitle}>{option.title}</span>
                  <span className={styles.chooserText}>{option.text}</span>
                </span>
                <svg className={styles.chooserArrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
