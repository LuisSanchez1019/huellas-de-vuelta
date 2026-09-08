import type { ReactNode } from "react";
import styles from "./DashboardPlaceholder.module.css";

export default function DashboardPlaceholder({
  icon,
  title,
  text,
  step,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  step?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon} aria-hidden="true">{icon}</div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.text}>{text}</p>
      {step && <span className={styles.step}>{step}</span>}
      {children && <div className={styles.slot}>{children}</div>}
    </div>
  );
}
