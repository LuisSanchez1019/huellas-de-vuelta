import type { ReactNode } from "react";
import styles from "./AdminStatCard.module.css";

export default function AdminStatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className={styles.card}>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <div>
        <p className={styles.value}>{value}</p>
        <p className={styles.label}>{label}</p>
      </div>
    </div>
  );
}
