import Link from "next/link";
import { ClockIcon, GenderIcon, PawIcon, PinIcon, TagIcon } from "@/components/icons/Icon";
import styles from "./landing.module.css";

export interface LostPetCardData {
  publicId: string;
  name: string;
  typeLabel: string;
  breed: string | null;
  age: string | null;
  sex: string | null;
  location: string;
  reportedAgo: string;
  photoUrl?: string | null;
}

export default function PetCard({ pet }: { pet: LostPetCardData }) {
  return (
    <article className={styles.petCard} role="listitem">
      {pet.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
        <img src={pet.photoUrl} alt={`Foto de ${pet.name}`} className={styles.petPhoto} />
      ) : (
        <span className={styles.petPhotoPlaceholder} aria-hidden="true"><PawIcon size={30} /></span>
      )}

      <div className={styles.petMain}>
        <div className={styles.petHead}>
          <span className={styles.petName}>{pet.name}</span>
          <span className={`${styles.petBadge} ${styles.petBadgeLost}`}>Perdido</span>
        </div>

        <div className={styles.petInfo}>
          <span className={styles.petInfoRow}>
            <PawIcon size={13} /><span>{pet.typeLabel}</span>
          </span>
          {pet.age && (
            <span className={styles.petInfoRow}>
              <ClockIcon size={13} /><span>{pet.age}</span>
            </span>
          )}
          {pet.sex && (
            <span className={styles.petInfoRow}>
              <GenderIcon size={13} /><span>{pet.sex}</span>
            </span>
          )}
          {pet.breed && (
            <span className={styles.petInfoRow}>
              <TagIcon size={13} /><span>{pet.breed}</span>
            </span>
          )}
          <span className={styles.petInfoRow}>
            <PinIcon size={13} /><span>{pet.location}</span>
          </span>
        </div>

        <p className={styles.petDate}>Reportada {pet.reportedAgo}</p>
        <Link className={styles.petFoundCta} href={`/m/${pet.publicId}`}>
          <PawIcon size={14} />
          Encontré esta mascota
        </Link>
      </div>
    </article>
  );
}
