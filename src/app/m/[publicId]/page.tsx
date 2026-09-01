"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPublicPet, PET_PHOTO_BUCKET, type PublicPet } from "@/lib/supabase/pets";
import { speciesLabels, statusLabels, sexLabels, ageUnitLabels, catColorLabels } from "@/lib/pets/labels";
import { LockIcon, PawIcon } from "@/components/icons/Icon";
import styles from "./publicPet.module.css";

const BADGE_CLASS: Record<PublicPet["status"], string> = {
  at_home: styles.badgeAtHome,
  lost: styles.badgeLost,
  found: styles.badgeFound,
  for_adoption: styles.badgeForAdoption,
};

function colorList(pet: PublicPet): string {
  return [pet.colorPrimary, pet.colorSecondary, pet.colorTertiary]
    .filter((value): value is string => Boolean(value))
    .map((value) => catColorLabels[value] ?? value)
    .join(", ");
}

export default function PublicPetPage() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;

  const [state, setState] = useState<"loading" | "found" | "not-found" | "error">("loading");
  const [pet, setPet] = useState<PublicPet | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!publicId) return;
    const supabase = createSupabaseBrowserClient();
    fetchPublicPet(supabase, publicId)
      .then(async (result) => {
        if (!result) {
          setState("not-found");
          return;
        }
        setPet(result);
        setState("found");
        if (result.photoPath) {
          const { data } = await supabase.storage
            .from(PET_PHOTO_BUCKET)
            .createSignedUrl(result.photoPath, 3600);
          if (data?.signedUrl) setPhotoUrl(data.signedUrl);
        }
      })
      .catch(() => setState("error"));
  }, [publicId]);

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <Link className={styles.back} href="/">← Huellas de Vuelta</Link>

        {state === "loading" && <p className={styles.state}>Cargando…</p>}
        {state === "not-found" && (
          <p className={styles.state}>No encontramos ninguna mascota con este código.</p>
        )}
        {state === "error" && (
          <p className={styles.state}>No fue posible cargar la información. Intenta de nuevo más tarde.</p>
        )}

        {state === "found" && pet && (
          <>
            <div className={styles.card}>
              <div className={styles.photo}>
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                  <img src={photoUrl} alt={`Foto de ${pet.name}`} />
                ) : (
                  <PawIcon size={64} className={styles.photoIcon} />
                )}
              </div>
              <div className={styles.body}>
                <span className={`${styles.badge} ${BADGE_CLASS[pet.status]}`}>{statusLabels[pet.status]}</span>
                <p className={styles.name}>{pet.name}</p>
                <p className={styles.meta}>
                  {pet.species === "other" ? pet.speciesOther || "Otro" : speciesLabels[pet.species]}
                  {pet.breed ? ` · ${pet.breed}` : ""}
                </p>
                {pet.description && <p className={styles.desc}>{pet.description}</p>}

                <div className={styles.detailsGrid}>
                  {pet.ageValue != null && pet.ageUnit && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Edad</span>
                      <span className={styles.detailValue}>
                        {pet.ageValue} {ageUnitLabels[pet.ageUnit].toLowerCase()}
                      </span>
                    </div>
                  )}
                  {pet.sex && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Sexo</span>
                      <span className={styles.detailValue}>{sexLabels[pet.sex]}</span>
                    </div>
                  )}
                  {colorList(pet) && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Colores</span>
                      <span className={styles.detailValue}>{colorList(pet)}</span>
                    </div>
                  )}
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Código de placa</span>
                    <span className={styles.detailValue}>{pet.publicId}</span>
                  </div>
                </div>

                <p className={styles.privacyNote}>
                  <LockIcon size={16} className={styles.inlineIcon} />
                  Los datos de contacto del propietario están protegidos. Si encontraste a esta mascota,
                  crea una cuenta para avisar de forma segura.
                </p>

                <Link className={styles.cta} href="/auth?mode=sign-up">
                  Contactar al propietario de forma segura
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
