"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPublicPet, PET_PHOTO_BUCKET, type PublicPet } from "@/lib/supabase/pets";
import { speciesLabels, statusLabels, sexLabels, ageUnitLabels, catColorLabels } from "@/lib/pets/labels";
import { AlertIcon, LockIcon, PawIcon, PinIcon } from "@/components/icons/Icon";
import ThemeToggle from "@/components/theme/ThemeToggle";
import FoundPetWizard from "@/components/reencuentro/FoundPetWizard";
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Vista interactiva de la página pública de una mascota (placa QR). Es
 * cliente porque necesita firmar la URL de la foto y montar el asistente de
 * "encontré esta mascota". El `page.tsx` (servidor) solo aporta metadata
 * (título/OG) a partir de los mismos datos públicos.
 */
export default function PublicPetView({ publicId }: { publicId: string }) {
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

  const isLost = pet?.status === "lost" && Boolean(pet.reportId);

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <Link className={styles.back} href="/">← Huellas de Vuelta</Link>
          <ThemeToggle />
        </div>

        {state === "loading" && <p className={styles.state}>Cargando…</p>}
        {state === "not-found" && (
          <p className={styles.state}>No encontramos ninguna mascota con este código.</p>
        )}
        {state === "error" && (
          <p className={styles.state}>No fue posible cargar la información. Intenta de nuevo más tarde.</p>
        )}

        {state === "found" && pet && (
          <>
            {isLost && (
              <div className={styles.lostAlert} role="alert">
                <span className={styles.lostAlertIcon} aria-hidden="true"><AlertIcon size={20} /></span>
                <div>
                  <p className={styles.lostAlertTitle}>Esta mascota está reportada como PERDIDA</p>
                  <p className={styles.lostAlertText}>
                    Si la viste o la tienes contigo, avísale a su familia con el botón de abajo. No
                    necesitas crear una cuenta.
                  </p>
                </div>
              </div>
            )}

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
                {pet.description && <p className={`${styles.desc} ${styles.clamp}`}>{pet.description}</p>}

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
                  {isLost && pet.lostCity && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Vista por última vez</span>
                      <span className={styles.detailValue}>
                        {pet.lostCity}
                        {pet.lostNeighborhood ? ` · ${pet.lostNeighborhood}` : ""}
                      </span>
                    </div>
                  )}
                  {isLost && pet.reportedAt && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Reportada</span>
                      <span className={styles.detailValue}>{formatDate(pet.reportedAt)}</span>
                    </div>
                  )}
                </div>

                {isLost && pet.lostDetails && (
                  <p className={styles.lostDetails}>
                    <PinIcon size={15} className={styles.inlineIcon} />
                    <span className={styles.clamp}>{pet.lostDetails}</span>
                  </p>
                )}

                <p className={styles.privacyNote}>
                  <LockIcon size={16} className={styles.inlineIcon} />
                  Los datos de contacto del propietario están protegidos. Huellas de Vuelta nunca
                  muestra su teléfono, correo ni dirección.
                </p>

                <p className={styles.plateId}>ID de placa: {pet.publicId}</p>
              </div>
            </div>

            {isLost && pet.reportId && (
              <FoundPetWizard
                publicId={pet.publicId}
                reportId={pet.reportId}
                petName={pet.name}
                defaultCity={pet.lostCity}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
