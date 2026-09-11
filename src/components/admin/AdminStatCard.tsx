import type { ReactNode } from "react";
import styles from "./AdminStatCard.module.css";

export default function AdminStatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className={styles.card}>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <span className={styles.text}>
        <span className={styles.value}>{value}</span>
        <span className={styles.label}>{label}</span>
      </span>
    </div>
  );
}
