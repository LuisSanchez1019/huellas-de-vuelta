"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPublicLostPets } from "@/lib/supabase/reports";
import { PET_PHOTO_BUCKET } from "@/lib/supabase/pets";
import { ageUnitLabels, sexLabels, speciesLabels } from "@/lib/pets/labels";
import type { PublicLostPet } from "@/lib/pets/reports";
import AutoScroller from "./AutoScroller";
import PetCard, { type LostPetCardData } from "./PetCard";
import styles from "./landing.module.css";

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

export default function LostPetsScroller() {
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [cards, setCards] = useState<LostPetCardData[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    fetchPublicLostPets(supabase)
      .then(async (rows: PublicLostPet[]) => {
        if (rows.length === 0) {
          setState("empty");
          return;
        }
        const urls = await Promise.all(
          rows.map(async (row) => {
            if (!row.photoPath) return null;
            const { data } = await supabase.storage
              .from(PET_PHOTO_BUCKET)
              .createSignedUrl(row.photoPath, 3600);
            return data?.signedUrl ?? null;
          }),
        );
        setCards(
          rows.map((row, index) => ({
            publicId: row.publicId,
            name: row.name,
            typeLabel: row.species === "other" ? row.speciesOther || "Otro" : speciesLabels[row.species],
            breed: row.breed,
            age:
              row.ageValue != null && row.ageUnit
                ? `${row.ageValue} ${ageUnitLabels[row.ageUnit].toLowerCase()}`
                : null,
            sex: row.sex ? sexLabels[row.sex] : null,
            location: `${row.city} · ${row.neighborhood}`,
            reportedAgo: timeAgo(row.reportedAt),
            photoUrl: urls[index],
          })),
        );
        setState("ready");
      })
      .catch(() => setState("empty"));
  }, []);

  if (state === "loading") return null;

  if (state === "empty") {
    return (
      <p className={styles.scrollerEmpty}>
        Aún no hay reportes de mascotas perdidas activos en la comunidad.
      </p>
    );
  }

  return (
    <AutoScroller ariaLabel="Mascotas que necesitan ayuda">
      {cards.map((card, index) => (
        <PetCard key={index} pet={card} />
      ))}
    </AutoScroller>
  );
}
