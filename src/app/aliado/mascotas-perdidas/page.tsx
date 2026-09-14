"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPublicLostPets } from "@/lib/supabase/reports";
import { getPetPhotoSignedUrl } from "@/lib/supabase/pets";
import type { PublicLostPet } from "@/lib/pets/reports";
import { ageUnitLabels, sexLabels, speciesLabels } from "@/lib/pets/labels";
import { PawIcon, PinIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "@/components/aliado/aliadoLists.module.css";

interface Row extends PublicLostPet {
  photoUrl: string | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "hace un momento";
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hace 1 día";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

/**
 * Mismas mascotas perdidas que aparecen en la página principal (RPC
 * `list_public_lost_pets`), leídas del lado del cliente para el panel del
 * aliado. Solo lectura, con enlace a la ficha pública de cada mascota.
 */
export default function AliadoMascotasPerdidasPage() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pets, setPets] = useState<Row[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const rows = await fetchPublicLostPets(supabase);
        const withPhotos = await Promise.all(
          rows.map(async (row) => ({
            ...row,
            photoUrl: row.photoPath ? await getPetPhotoSignedUrl(supabase, row.photoPath) : null,
          })),
        );
        if (!active) return;
        setPets(withPhotos);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Mascotas perdidas</h1>
        <p className={controls.pageSubtitle}>
          Mascotas con un reporte de pérdida activo, las mismas que aparecen en la página principal.
        </p>
      </div>

      {state === "loading" && <p className={controls.loading}>Cargando…</p>}
      {state === "error" && <p className={controls.empty}>No fue posible cargar los reportes.</p>}
      {state === "ready" && pets.length === 0 && (
        <p className={controls.empty}>Por ahora no hay mascotas reportadas como perdidas.</p>
      )}

      {state === "ready" && pets.length > 0 && (
        <ul className={styles.grid}>
          {pets.map((pet) => (
            <li key={pet.reportId} className={styles.card}>
              {pet.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                <img src={pet.photoUrl} alt={pet.name} className={styles.photo} />
              ) : (
                <span className={styles.photoPlaceholder} aria-hidden="true"><PawIcon size={30} /></span>
              )}
              <div className={styles.body}>
                <span className={styles.badge}><PinIcon size={12} /> Perdida</span>
                <p className={styles.name}>{pet.name}</p>
                <p className={styles.meta}>
                  {[
                    pet.species === "other" ? pet.speciesOther || "Otro" : speciesLabels[pet.species],
                    pet.breed,
                    pet.ageValue != null && pet.ageUnit
                      ? `${pet.ageValue} ${ageUnitLabels[pet.ageUnit].toLowerCase()}`
                      : null,
                    pet.sex ? sexLabels[pet.sex] : null,
                  ].filter(Boolean).join(" · ")}
                </p>
                <p className={styles.meta}>
                  {[pet.city, pet.neighborhood].filter(Boolean).join(" · ")} · {timeAgo(pet.reportedAt)}
                </p>
                <Link className={styles.contact} href={`/m/${pet.publicId}`} target="_blank">
                  Ver ficha
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
