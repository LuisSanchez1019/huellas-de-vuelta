"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPublicOrgPets, type PublicOrgPetRow } from "@/lib/supabase/orgPetsPublic";
import { speciesLabels } from "@/lib/pets/labels";
import { whatsappLink } from "@/lib/phone";
import { PawIcon, HandIcon } from "@/components/icons/Icon";
import { ListSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";
import styles from "@/components/aliado/aliadoLists.module.css";

function speciesText(pet: PublicOrgPetRow): string {
  if (pet.species === "other") return pet.speciesOther || "Otro";
  return speciesLabels[pet.species as keyof typeof speciesLabels] ?? "Mascota";
}

/**
 * Mismas mascotas que las fundaciones marcan como "busca padrino" (RPC
 * `list_public_org_pets`, filtradas por `needsSponsor`) — las mismas que se
 * muestran en la sección "Apadrina una mascota" de la página principal. Solo
 * lectura: el aliado puede contactar a la organización responsable.
 */
export default function AliadoApadrinaPage() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pets, setPets] = useState<PublicOrgPetRow[]>([]);

  useEffect(() => {
    let active = true;
    fetchPublicOrgPets(createSupabaseBrowserClient())
      .then((rows) => {
        if (!active) return;
        setPets(rows.filter((pet) => pet.needsSponsor));
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Apadrina una mascota</h1>
        <p className={controls.pageSubtitle}>
          Mascotas al cuidado de fundaciones que necesitan un padrino para cubrir su alimentación y sus
          tratamientos. Son las mismas que aparecen en la página principal.
        </p>
      </div>

      {state === "loading" && <ListSkeletonBody />}
      {state === "error" && <p className={controls.empty}>No fue posible cargar las mascotas.</p>}
      {state === "ready" && pets.length === 0 && (
        <p className={controls.empty}>
          Por ahora ninguna organización tiene mascotas buscando padrino.
        </p>
      )}

      {state === "ready" && pets.length > 0 && (
        <ul className={styles.grid}>
          {pets.map((pet) => {
            const wa = whatsappLink(pet.org.whatsapp);
            return (
              <li key={pet.id} className={styles.card}>
                {pet.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                  <img src={pet.photoUrl} alt={pet.name} className={styles.photo} />
                ) : (
                  <span className={styles.photoPlaceholder} aria-hidden="true"><PawIcon size={30} /></span>
                )}
                <div className={styles.body}>
                  <span className={styles.badge}><HandIcon size={12} /> Busca padrino</span>
                  <p className={styles.name}>{pet.name}</p>
                  <p className={styles.meta}>
                    {[speciesText(pet), pet.breed, pet.age].filter(Boolean).join(" · ")}
                  </p>

                  <div className={styles.orgRow}>
                    {pet.org.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- logo público de Supabase Storage
                      <img src={pet.org.logoUrl} alt={pet.org.name} className={styles.orgLogo} />
                    ) : (
                      <span className={styles.orgLogoPlaceholder} aria-hidden="true"><PawIcon size={14} /></span>
                    )}
                    <span>
                      <span className={styles.orgName}>{pet.org.name}</span>
                      {pet.org.city && <span className={styles.orgCity}> · {pet.org.city}</span>}
                    </span>
                  </div>

                  {wa ? (
                    <a className={styles.contact} href={wa} target="_blank" rel="noopener noreferrer">
                      Escribir a {pet.org.name}
                    </a>
                  ) : (
                    <span className={styles.contactDisabled}>Contacto en la organización</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
