import Link from "next/link";
import type { MockAdoption } from "@/data/mock";
import styles from "./landing.module.css";

const speciesIcon: Record<string, string> = { Perro: "🐶", Gata: "🐱" };

export default function AdoptionCard({ pet }: { pet: MockAdoption }) {
  return (
    <article className={styles.adoptionCard} role="listitem">
      <div
        className={`${styles.avatar} ${styles.avatarSmall}`}
        style={{ background: `linear-gradient(135deg, ${pet.colorFrom}, ${pet.colorTo})` }}
        aria-hidden="true"
      >
        {speciesIcon[pet.species] ?? "🐾"}
      </div>
      <div className={styles.adoptionBody}>
        <p className={styles.adoptionName}>{pet.name}</p>
        <p className={styles.adoptionMeta}>{pet.species} · {pet.age} · {pet.location}</p>
        <Link className={styles.adoptionCta} href="/auth?mode=sign-up">Quiero adoptar</Link>
      </div>
    </article>
  );
}
