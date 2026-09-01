"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPets, getPetPhotoSignedUrl } from "@/lib/supabase/pets";
import type { Pet } from "@/lib/supabase/types";
import { PawIcon } from "@/components/icons/Icon";
import { ageUnitLabels, sexLabels, speciesLabels, statusLabels } from "@/lib/pets/labels";
import Toast from "@/components/ui/Toast";
import styles from "@/components/mascotas/petsList.module.css";
import headStyles from "@/components/mascotas/registerPet.module.css";

const badgeClassByStatus: Record<Pet["status"], string> = {
  at_home: styles.badgeAtHome,
  lost: styles.badgeLost,
  found: styles.badgeFound,
  for_adoption: styles.badgeForAdoption,
};

function petMeta(pet: Pet): string {
  const parts: string[] = [pet.species === "other" ? pet.species_other || "Otro" : speciesLabels[pet.species]];
  if (pet.age_value != null && pet.age_unit) {
    parts.push(`${pet.age_value} ${ageUnitLabels[pet.age_unit].toLowerCase()}`);
  }
  if (pet.sex) parts.push(sexLabels[pet.sex]);
  return parts.join(" · ");
}

function MascotasPanelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdName = searchParams.get("created");
  const photoFailed = searchParams.get("photo") === "failed";

  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
  }, []);

  const loadPets = useCallback(() => {
    return Promise.resolve().then(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const data = await fetchPets(supabase, { includeArchived: false });
        setPets(data);

        const entries = await Promise.all(
          data
            .filter((pet) => pet.photo_path)
            .map(async (pet) => {
              const url = await getPetPhotoSignedUrl(supabase, pet.photo_path as string);
              return [pet.id, url] as const;
            }),
        );
        setPhotoUrls(Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null)));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "No fue posible cargar las mascotas.");
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (checking) return;
    if (!session) {
      // Diferido para cumplir react-hooks/set-state-in-effect (mismo patrón que loadPets).
      Promise.resolve().then(() => setIsLoading(false));
      return;
    }
    loadPets();
  }, [checking, session, loadPets]);

  return (
    <div>
      <div className={headStyles.pageHead}>
        <h1 className={headStyles.pageTitle}>Mis mascotas</h1>
        <p className={headStyles.pageSubtitle}>Las mascotas que tienes registradas a tu cuidado.</p>
      </div>

      <Link className={styles.newLink} href="/dashboard/mascotas/nueva">+ Registrar mascota</Link>

      {!checking && !session && (
        <p className={styles.empty}>Inicia sesión con una cuenta real para ver y registrar tus mascotas.</p>
      )}

      {error ? (
        <Toast variant="error" message={error} onClose={() => setError(null)} />
      ) : createdName ? (
        <Toast
          variant="success"
          message={
            `«${createdName}» se registró correctamente.` +
            (photoFailed ? " La foto no pudo subirse; puedes añadirla más tarde." : "")
          }
          onClose={() => router.replace("/dashboard/mascotas")}
          duration={7000}
        />
      ) : null}

      {session && (
        isLoading ? (
          <p className={styles.loading}>Cargando mascotas…</p>
        ) : pets.length === 0 ? (
          <p className={styles.empty}>Todavía no has registrado ninguna mascota.</p>
        ) : (
          <ul className={styles.grid}>
            {pets.map((pet) => (
              <li key={pet.id} className={styles.card}>
                {photoUrls[pet.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                  <img src={photoUrls[pet.id]} alt={`Foto de ${pet.name}`} className={styles.thumb} />
                ) : (
                  <span className={styles.thumbPlaceholder} aria-hidden="true"><PawIcon size={26} /></span>
                )}
                <div className={styles.cardMain}>
                  <div className={styles.cardTop}>
                    <span className={styles.petName}>{pet.name}</span>
                    <span className={`${styles.badge} ${badgeClassByStatus[pet.status]}`}>{statusLabels[pet.status]}</span>
                  </div>
                  <p className={styles.meta}>{petMeta(pet)}</p>
                  {pet.description && <p className={styles.desc}>{pet.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

export default function MascotasPanelPage() {
  return (
    <Suspense fallback={null}>
      <MascotasPanelContent />
    </Suspense>
  );
}
