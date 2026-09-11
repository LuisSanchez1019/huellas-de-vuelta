import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./landing.module.css";

interface SectionTitleProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  /** Acción a la derecha del título (p. ej. "Ver en el mapa"). Tiene prioridad sobre `viewAllHref`. */
  action?: ReactNode;
  viewAllHref?: string;
  viewAllLabel?: string;
}

export default function SectionTitle({
  eyebrow,
  title,
  subtitle,
  action,
  viewAllHref,
  viewAllLabel,
}: SectionTitleProps) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={styles.sectionTitleText}>{title}</h2>
        {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
      </div>
      {action
        ? action
        : viewAllHref && viewAllLabel && (
            <Link className={styles.viewAllLink} href={viewAllHref}>
              {viewAllLabel} →
            </Link>
          )}
    </div>
  );
}
