import { getCachedPublicLostPets } from "@/lib/supabase/publicCache";
import { ageUnitLabels, sexLabels, speciesLabels } from "@/lib/pets/labels";
import SectionTitle from "./SectionTitle";
import CardSlider from "./CardSlider";
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

/**
 * Server component: mascotas REALES con reporte de pérdida activo
 * (RPC `list_public_lost_pets`, cacheada). El formato relativo de fecha se
 * calcula en cada render para que no quede desfasado aunque los datos vengan
 * de caché. Sin mocks; si no hay reportes activos, estado vacío.
 */
export default async function LostPetsSection() {
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
    location: [row.city, row.neighborhood].filter(Boolean).join(" · "),
    reportedAgo: timeAgo(row.reportedAt),
    photoUrl: row.photoUrl,
  }));

  return (
    <section id="mascotas" className={styles.section} aria-label="Mascotas perdidas">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Comunidad activa"
          title="Mascotas perdidas"
          subtitle="Ayúdanos a encontrarlas. Cada reporte es de una familia que está buscando a su mascota ahora mismo."
        />
        {cards.length === 0 ? (
          <p className={styles.scrollerEmpty}>
            No hay reportes de mascotas perdidas activos en la comunidad en este momento.
          </p>
        ) : (
          <CardSlider ariaLabel="Mascotas perdidas">
            {cards.map((card) => (
              <PetCard key={card.publicId} pet={card} />
            ))}
          </CardSlider>
        )}
      </div>
    </section>
  );
}
