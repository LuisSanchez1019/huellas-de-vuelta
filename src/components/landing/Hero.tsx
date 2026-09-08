import Link from "next/link";
import { HeartIcon, ReportIcon, SearchIcon } from "@/components/icons/Icon";
import { getCachedLandingStats } from "@/lib/supabase/publicCache";
import styles from "./Hero.module.css";

const numberFormat = new Intl.NumberFormat("es-CO");

const actions = [
  {
    href: "/auth?mode=sign-up",
    icon: <ReportIcon size={22} />,
    title: "Reporta una mascota perdida",
    text: "Publica el caso y avisa a la comunidad cercana.",
    variant: styles.actionLost,
  },
  {
    href: "/#mascotas",
    icon: <SearchIcon size={22} />,
    title: "Encontré a una mascota",
    text: "Revisa los reportes activos y ayúdala a volver a casa.",
    variant: styles.actionFound,
  },
  {
    href: "/#adopciones",
    icon: <HeartIcon size={22} />,
    title: "Quiero adoptar",
    text: "Conoce a las mascotas que esperan un hogar.",
    variant: styles.actionAdopt,
  },
];

const STAT_ORDER = ["registered", "reunions", "orgs"] as const;

export default async function Hero() {
  const stats = await getCachedLandingStats().catch(() => []);
  const trust = STAT_ORDER
    .map((key) => stats.find((s) => s.key === key))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <section className={styles.hero} aria-label="Presentación">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Red de ayuda para mascotas · Colombia</span>
          <h1 className={styles.title}>
            Cada mascota merece <span className={styles.titleAccent}>volver a casa</span>
          </h1>
          <p className={styles.description}>
            Conectamos personas, mascotas y organizaciones para que más historias tengan un final feliz.
            Reportar, encontrar y adoptar, de forma gratuita y segura.
          </p>

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

          {trust.length > 0 && (
            <dl className={styles.trustRow}>
              {trust.map((stat) => (
                <div key={stat.key} className={styles.trustItem}>
                  <dt className={styles.trustValue}>{numberFormat.format(stat.value)}</dt>
                  <dd className={styles.trustLabel}>{stat.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className={styles.visual} aria-hidden="true">
          <div className={styles.visualCard}>
            <div className={styles.visualGlow} />
            <svg className={styles.visualPaws} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g fill="currentColor">
                <ellipse cx="40" cy="46" rx="9" ry="11" />
                <ellipse cx="58" cy="34" rx="6" ry="8" />
                <ellipse cx="24" cy="36" rx="6" ry="8" />
                <ellipse cx="41" cy="70" rx="16" ry="13" />
                <ellipse cx="150" cy="150" rx="9" ry="11" />
                <ellipse cx="168" cy="138" rx="6" ry="8" />
                <ellipse cx="134" cy="140" rx="6" ry="8" />
                <ellipse cx="151" cy="174" rx="16" ry="13" />
              </g>
            </svg>
            <span className={styles.script}>Pequeñas acciones,<br />grandes reencuentros</span>
            <div className={styles.blob}>
              <span>Juntos hacemos<br />la diferencia</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
