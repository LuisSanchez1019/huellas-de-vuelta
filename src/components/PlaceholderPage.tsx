import type { ReactNode } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "./PlaceholderPage.module.css";

export default function PlaceholderPage({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <main className={styles.page}>
      <div className={styles.themeSlot}>
        <ThemeToggle />
      </div>
      <div className={styles.inner}>
        <div className={styles.icon} aria-hidden="true">{icon}</div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        <Link className={styles.back} href="/">← Volver al inicio</Link>
      </div>
    </main>
  );
}
