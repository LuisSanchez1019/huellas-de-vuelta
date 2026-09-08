import Link from "next/link";
import { PawIcon } from "@/components/icons/Icon";
import type { PublicAdoptionPet } from "@/lib/supabase/publicCache";
import { ageUnitLabels, sexLabels, speciesLabels } from "@/lib/pets/labels";
import styles from "./landing.module.css";

function metaLine(pet: PublicAdoptionPet): string {
  const parts = [pet.species === "other" ? pet.speciesOther || "Otro" : speciesLabels[pet.species]];
  if (pet.ageValue != null && pet.ageUnit) {
    parts.push(`${pet.ageValue} ${ageUnitLabels[pet.ageUnit].toLowerCase()}`);
  }
  if (pet.breed) parts.push(pet.breed);
  if (pet.sex) parts.push(sexLabels[pet.sex]);
  return parts.join(" · ");
}

export default function AdoptionCard({ pet }: { pet: PublicAdoptionPet }) {
  return (
    <article className={styles.adoptionCard} role="listitem">
      <div className={`${styles.avatar} ${styles.avatarSmall}`} aria-hidden="true">
        {pet.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
          <img src={pet.photoUrl} alt={`Foto de ${pet.name}`} className={styles.avatarImg} />
        ) : (
          <PawIcon size={34} className={styles.avatarIcon} />
        )}
      </div>
      <div className={styles.adoptionBody}>
        <p className={styles.adoptionName}>{pet.name}</p>
        <p className={styles.adoptionMeta}>{metaLine(pet)}</p>
        <Link className={styles.adoptionCta} href={`/m/${pet.publicId}`}>Ver mascota</Link>
      </div>
    </article>
  );
}
