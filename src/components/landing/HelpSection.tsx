import { getCachedPublicLostPets } from "@/lib/supabase/publicCache";
import { ageUnitLabels, sexLabels, speciesLabels } from "@/lib/pets/labels";
import type { LostPetCardData } from "./PetCard";
import SectionTitle from "./SectionTitle";
import LostPetsScroller from "./LostPetsScroller";
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

/**
 * Server component: la lista de mascotas perdidas (RPC pública) y la firma
 * de sus fotos vienen cacheadas (ver `publicCache.ts`) — el formato relativo
 * de fecha ("hace X horas") se calcula aquí, en cada render, para que nunca
 * quede desactualizado aunque los datos vengan de caché.
 */
export default async function HelpSection() {
  const rows = await getCachedPublicLostPets().catch(() => []);
  const cards: LostPetCardData[] = rows.map((row) => ({
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
    photoUrl: row.photoUrl,
  }));

  return (
    <section id="mascotas" className={styles.section} aria-label="Mascotas que necesitan ayuda">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Comunidad activa"
          title="Mascotas perdidas"
          subtitle="Todos los reportes activos de mascotas perdidas por sus familias. Compártelos para acelerar el reencuentro."
        />
        <LostPetsScroller cards={cards} />
      </div>
    </section>
  );
}
