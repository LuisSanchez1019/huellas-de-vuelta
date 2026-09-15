import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./StatCard.module.css";

/**
 * Tarjeta de estadística/contador compartida por el inicio de usuario, el
 * inicio de administrador y los resúmenes de organización (veterinaria/
 * fundación). Número y etiqueta son bloques separados y apilados — nunca
 * texto en línea — para que nunca queden pegados como "0mascotas": el
 * número siempre tiene su propia línea, con su propia jerarquía tipográfica,
 * sin depender de un espacio de texto entre ambos.
 */
export default function StatCard({
  icon,
  label,
  value,
  href,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  /** Si se da, la tarjeta completa es un enlace (como en el inicio de usuario). */
  href?: string;
  /** Resalta la tarjeta (ej. hay mascotas perdidas / avisos sin leer). */
  highlight?: boolean;
}) {
  const className = `${styles.card} ${highlight ? styles.cardHighlight : ""}`;
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <span className={styles.text}>
        <span className={styles.value}>{value}</span>
        <span className={styles.label}>{label}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
