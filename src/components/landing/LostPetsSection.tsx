import { getCachedPublicLostPets } from "@/lib/supabase/publicCache";
import { toLostPetCard } from "@/lib/pets/publicPetCards";
import SectionTitle from "./SectionTitle";
import CardSlider from "./CardSlider";
import PetCard from "./PetCard";
import styles from "./landing.module.css";

/**
 * Server component: mascotas REALES con reporte de pérdida activo
 * (RPC `list_public_lost_pets`, cacheada). El formato relativo de fecha se
 * calcula en cada render para que no quede desfasado aunque los datos vengan
 * de caché. Sin mocks; si no hay reportes activos, estado vacío.
 */
export default async function LostPetsSection() {
  const rows = await getCachedPublicLostPets().catch(() => []);
  const cards = rows.map(toLostPetCard);

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
