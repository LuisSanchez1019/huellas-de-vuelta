import Link from "next/link";
import {
  getCachedAdoptionPets,
  getCachedOrgPets,
  getCachedPublicLostPets,
} from "@/lib/supabase/publicCache";
import { toAdoptionItems, toLostPetCard } from "@/lib/pets/publicPetCards";
import CardSlider from "@/components/landing/CardSlider";
import PetCard from "@/components/landing/PetCard";
import AdoptionCard from "@/components/landing/AdoptionCard";
import controls from "@/components/ui/controls.module.css";

/**
 * Contenido real relacionado con la causa en el inicio del usuario: mismas
 * fuentes públicas cacheadas que ya usa el Landing (`list_public_lost_pets`,
 * `list_public_adoption_pets`, `list_public_org_pets` vía `publicCache.ts`),
 * las mismas tarjetas (`PetCard`, `AdoptionCard`) y el mismo mapeo
 * (`publicPetCards.ts`) — sin duplicar consultas ni inventar datos. Server
 * component: no depende de la sesión, así que puede vivir junto al resumen
 * privado (`DashboardHome`, que sí es cliente) sin bloquear su propia carga.
 */
export default async function DashboardPetsSections() {
  const [lostRows, adoptionUserPets, adoptionOrgPets] = await Promise.all([
    getCachedPublicLostPets().catch(() => []),
    getCachedAdoptionPets().catch(() => []),
    getCachedOrgPets().catch(() => []),
  ]);

  const lostCards = lostRows.map(toLostPetCard);
  const adoptionItems = toAdoptionItems(adoptionUserPets, adoptionOrgPets);

  return (
    <>
      <section className={controls.section}>
        <div className={controls.sectionHead}>
          <p className={controls.sectionTitle}>Mascotas perdidas</p>
          <Link className={controls.sectionLink} href="/#mascotas">
            Ver todas →
          </Link>
        </div>
        <div className={controls.sectionBody}>
          {lostCards.length === 0 ? (
            <p className={controls.empty}>No hay reportes de mascotas perdidas activos en este momento.</p>
          ) : (
            <CardSlider ariaLabel="Mascotas perdidas">
              {lostCards.map((card) => (
                <PetCard key={card.publicId} pet={card} />
              ))}
            </CardSlider>
          )}
        </div>
      </section>

      <section className={controls.section}>
        <div className={controls.sectionHead}>
          <p className={controls.sectionTitle}>Mascotas en adopción</p>
          <Link className={controls.sectionLink} href="/#adopciones">
            Ver todas →
          </Link>
        </div>
        <div className={controls.sectionBody}>
          {adoptionItems.length === 0 ? (
            <p className={controls.empty}>Todavía no hay mascotas publicadas para adopción.</p>
          ) : (
            <CardSlider ariaLabel="Mascotas en adopción">
              {adoptionItems.map((item) => (
                <AdoptionCard key={item.key} item={item} />
              ))}
            </CardSlider>
          )}
        </div>
      </section>
    </>
  );
}
