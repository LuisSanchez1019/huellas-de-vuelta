import Link from "next/link";
import type { MockPet } from "@/data/mock";
import { PawIcon, PinIcon } from "@/components/icons/Icon";
import styles from "./landing.module.css";

export default function PetCard({ pet }: { pet: MockPet }) {
  const isLost = pet.status === "lost";
  return (
    <article className={styles.petCard} role="listitem">
      <div
        className={styles.avatar}
        style={{ background: `linear-gradient(135deg, ${pet.colorFrom}, ${pet.colorTo})` }}
        aria-hidden="true"
      >
        <PawIcon size={38} className={styles.avatarIcon} />
      </div>
      <span className={isLost ? `${styles.petBadge} ${styles.petBadgeLost}` : `${styles.petBadge} ${styles.petBadgeFound}`}>
        {isLost ? "Perdido" : "Encontrado"}
      </span>
      <div className={styles.petBody}>
        <p className={styles.petName}>{pet.name}</p>
        <p className={styles.petMeta}>{pet.species} · {pet.breed}</p>
        <p className={styles.petLocation}>
          <PinIcon size={14} className={styles.inlineIcon} />
          {pet.location} · {pet.reportedAgo}
        </p>
        <Link className={styles.petCta} href="/auth?mode=sign-up">Ayudar a encontrarla →</Link>
      </div>
    </article>
  );
}
