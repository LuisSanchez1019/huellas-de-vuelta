import Link from "next/link";
import styles from "./PlaceholderPage.module.css";

export default function PlaceholderPage({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.icon} aria-hidden="true">{icon}</div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        <Link className={styles.back} href="/">← Volver al inicio</Link>
      </div>
    </main>
  );
}
