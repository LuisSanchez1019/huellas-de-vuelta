import Link from "next/link";
import type { MockVeterinary } from "@/data/mock";
import styles from "./landing.module.css";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export default function VeterinaryCard({ vet }: { vet: MockVeterinary }) {
  return (
    <article className={styles.vetCard} role="listitem">
      <div className={styles.vetLogo} aria-hidden="true">{initials(vet.name)}</div>
      <p className={styles.vetName}>{vet.name}</p>
      <p className={styles.vetCity}>{vet.city}</p>
      <p className={styles.vetDesc}>{vet.description}</p>
      <Link className={styles.vetCta} href="/auth?mode=sign-up">Ver perfil →</Link>
    </article>
  );
}
