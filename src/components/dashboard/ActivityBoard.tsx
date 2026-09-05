"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPets, getPetPhotoSignedUrl } from "@/lib/supabase/pets";
import { fetchReceivedPetEvents } from "@/lib/supabase/reportEvents";
import { speciesLabels } from "@/lib/pets/labels";
import type { Pet } from "@/lib/supabase/types";
import type { ReportEvent } from "@/lib/pets/reencuentro";
import { PawIcon, PinIcon, ClockIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "./activityBoard.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function speciesLine(pet: { species: string; species_other: string | null; breed: string | null }): string {
  const species =
    pet.species === "other" ? pet.species_other || "Otro" : speciesLabels[pet.species as keyof typeof speciesLabels];
  return pet.breed ? `${species} · ${pet.breed}` : species;
}

function PetPhoto({ url, alt }: { url: string | undefined; alt: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
    return <img src={url} alt={alt} className={styles.photo} />;
  }
  return <span className={styles.photoPlaceholder} aria-hidden="true"><PawIcon size={22} /></span>;
}

/**
 * "Mi actividad": tarjetas con el estilo del Landing, a partir de datos REALES
 * de `pets` (perdidas/en adopción) y `pet_report_events` (mascotas que una
 * organización ya confirmó haber recibido) — no duplica el sistema de
 * mascotas ni de reportes, solo los agrupa visualmente.
 */
export default function ActivityBoard() {
  const [state, setState] = useState<"loading" | "ready" | "no-session" | "error">("loading");
  const [pets, setPets] = useState<Pet[]>([]);
  const [receivedEvents, setReceivedEvents] = useState<ReportEvent[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      setState("loading");
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (active) setState("no-session");
        return;
      }
      try {
        const [petRows, eventRows] = await Promise.all([
          fetchPets(supabase),
          fetchReceivedPetEvents(supabase),
        ]);
        if (!active) return;
        setPets(petRows);
        setReceivedEvents(eventRows);

        const withPhoto = petRows.filter((p) => p.photo_path);
        const entries = await Promise.all(
          withPhoto.map(async (p) => [p.id, await getPetPhotoSignedUrl(supabase, p.photo_path as string)] as const),
        );
        if (!active) return;
        setPhotoUrls(Object.fromEntries(entries.filter((e): e is [string, string] => e[1] !== null)));
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") return <p className={controls.loading}>Cargando tu actividad…</p>;
  if (state === "no-session") {
    return <p className={controls.empty}>Inicia sesión con una cuenta real para ver tu actividad.</p>;
  }
  if (state === "error") return <p className={controls.empty}>No fue posible cargar tu actividad.</p>;

  const lost = pets.filter((p) => p.status === "lost");
  const adoption = pets.filter((p) => p.status === "for_adoption");

  // Un evento por mascota (el más reciente por org_received_at, ya viene ordenado así).
  const receivedByPet = new Map<string, ReportEvent>();
  for (const ev of receivedEvents) {
    if (!receivedByPet.has(ev.pet_id)) receivedByPet.set(ev.pet_id, ev);
  }
  const inOrg = [...receivedByPet.values()];

  return (
    <div>
      <section className={styles.section}>
        <p className={styles.sectionTitle}>Mascotas perdidas</p>
        <p className={styles.sectionSubtitle}>Reportes de pérdida actualmente activos.</p>
        {lost.length === 0 ? (
          <p className={styles.empty}>No tienes mascotas perdidas en este momento.</p>
        ) : (
          <div className={styles.grid}>
            {lost.map((pet) => (
              <article key={pet.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <PetPhoto url={photoUrls[pet.id]} alt={pet.name} />
                  <div className={styles.headText}>
                    <p className={styles.name}>{pet.name}</p>
                    <p className={styles.meta}>{speciesLine(pet)}</p>
                  </div>
                </div>
                <span className={`${styles.badge} ${styles.badgeLost}`}>Perdida</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>En adopción</p>
        <p className={styles.sectionSubtitle}>Mascotas tuyas publicadas para adopción.</p>
        {adoption.length === 0 ? (
          <p className={styles.empty}>No tienes mascotas en adopción actualmente.</p>
        ) : (
          <div className={styles.grid}>
            {adoption.map((pet) => (
              <article key={pet.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <PetPhoto url={photoUrls[pet.id]} alt={pet.name} />
                  <div className={styles.headText}>
                    <p className={styles.name}>{pet.name}</p>
                    <p className={styles.meta}>{speciesLine(pet)}</p>
                  </div>
                </div>
                <span className={`${styles.badge} ${styles.badgeAdoption}`}>En adopción</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>En veterinarias / fundaciones</p>
        <p className={styles.sectionSubtitle}>
          Mascotas que una organización confirmó haber recibido.
        </p>
        {inOrg.length === 0 ? (
          <p className={styles.empty}>Ninguna de tus mascotas está en una organización por ahora.</p>
        ) : (
          <div className={styles.grid}>
            {inOrg.map((ev) => (
              <article key={ev.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <PetPhoto url={ev.pet?.photo_path ? photoUrls[ev.pet_id] : undefined} alt={ev.pet?.name ?? "Mascota"} />
                  <div className={styles.headText}>
                    <p className={styles.name}>{ev.pet?.name ?? "Mascota"}</p>
                    {ev.pet && <p className={styles.meta}>{speciesLine(ev.pet)}</p>}
                  </div>
                </div>
                <span className={`${styles.badge} ${styles.badgeReceived}`}>Recibida</span>
                {ev.selected_org && (
                  <div className={styles.orgBox}>
                    <p className={styles.orgLabel}>
                      {ev.selected_org.category === "veterinaria" ? "Veterinaria" : "Fundación"}
                    </p>
                    <p className={styles.orgName}>{ev.selected_org.name}</p>
                    {ev.selected_org.city && (
                      <p className={styles.line}><PinIcon size={12} /> {ev.selected_org.city}</p>
                    )}
                    {ev.org_received_at && (
                      <p className={styles.orgDate}>
                        <ClockIcon size={11} /> Recibida el {formatDate(ev.org_received_at)}
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
