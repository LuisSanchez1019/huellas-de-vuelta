import { mockStats } from "@/data/mock";
import styles from "./landing.module.css";

export default function StatsSection() {
  return (
    <section className={styles.statsSection} aria-label="Estadísticas de impacto">
      <div className={styles.statsGrid}>
        {mockStats.map((stat) => (
          <div key={stat.id} className={styles.statItem}>
            <p className={styles.statValue}>{stat.value}</p>
            <p className={styles.statLabel}>{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
