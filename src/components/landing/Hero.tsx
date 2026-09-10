import Link from "next/link";
import {
  HandIcon,
  HeartIcon,
  ReportIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons/Icon";
import OrgAccessCard from "./OrgAccessCard";
import styles from "./Hero.module.css";

const actions = [
  {
    href: "/auth/usuarios?mode=sign-up",
    icon: <ReportIcon size={20} />,
    title: "Reportar una mascota perdida",
    text: "Publica el reporte y ayuda a que la comunidad la encuentre.",
    variant: styles.actionLost,
  },
  {
    href: "/#mascotas",
    icon: <SearchIcon size={20} />,
    title: "Encontré una mascota",
    text: "Consulta qué hacer si encontraste una mascota.",
    variant: styles.actionFound,
  },
  {
    href: "/#adopciones",
    icon: <HeartIcon size={20} />,
    title: "Quiero adoptar",
    text: "Conoce mascotas que buscan un nuevo hogar.",
    variant: styles.actionAdopt,
  },
];

export default function Hero() {
  return (
    <section className={styles.hero} aria-label="Presentación">
      {/* El banner de arriba ya muestra el titular con jerarquía fuerte; aquí
          va como <h1> real para SEO y accesibilidad, sin repetirlo en grande. */}
      <h1 className={styles.srOnly}>Cada mascota merece volver a casa</h1>

      <div className={styles.actions}>
        {actions.map((action) => (
          <Link key={action.title} href={action.href} className={`${styles.action} ${action.variant}`}>
            <span className={styles.actionIcon} aria-hidden="true">{action.icon}</span>
            <span className={styles.actionBody}>
              <span className={styles.actionTitle}>{action.title}</span>
              <span className={styles.actionText}>{action.text}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className={styles.access} aria-label="Accesos de cuenta">
        <Link href="/auth/usuarios" className={`${styles.accessCard} ${styles.accessUser}`}>
          <span className={styles.accessIcon} aria-hidden="true"><UserIcon size={22} /></span>
          <span className={styles.accessTitle}>Ingreso usuarios</span>
          <span className={styles.accessText}>Accede a tus mascotas, reportes y notificaciones.</span>
        </Link>

        <OrgAccessCard />

        <Link href="/auth/aliado" className={`${styles.accessCard} ${styles.accessAlly}`}>
          <span className={styles.accessIcon} aria-hidden="true"><HandIcon size={22} /></span>
          <span className={styles.accessTitle}>Ingreso aliado</span>
          <span className={styles.accessText}>Accede como aliado de Huellas de Vuelta.</span>
        </Link>
      </div>
    </section>
  );
}
