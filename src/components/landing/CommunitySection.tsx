import Link from "next/link";
import { HeartIcon, PawIcon, PinIcon, BookIcon } from "@/components/icons/Icon";
import {
  getCachedAdoptionPets,
  getCachedPublicLostPets,
  getCachedReunions,
} from "@/lib/supabase/publicCache";
import { speciesLabels } from "@/lib/pets/labels";
import styles from "./landing.module.css";

function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

function speciesLabel(species: string, other: string | null): string {
  if (species === "other") return other || "Otro";
  return speciesLabels[species as keyof typeof speciesLabels] ?? "Mascota";
}

export default async function CommunitySection() {
  const [lost, adoption, reunions] = await Promise.all([
    getCachedPublicLostPets().catch(() => []),
    getCachedAdoptionPets().catch(() => []),
    getCachedReunions().catch(() => []),
  ]);

  const lostTop = lost.slice(0, 4);
  const adoptionTop = adoption.slice(0, 4);
  const reunionsTop = reunions.slice(0, 4);

  return (
    <section id="comunidad" className={styles.communitySection} aria-label="Mascotas de la comunidad">
      <div className={styles.sectionInner}>
        <div className={styles.communityGrid}>
          {/* -------- Mascotas perdidas -------- */}
          <article className={`${styles.panel} ${styles.panelLost}`}>
            <header className={styles.panelHead}>
              <span className={styles.panelIcon} aria-hidden="true"><PawIcon size={18} /></span>
              <div className={styles.panelHeadText}>
                <h2 className={styles.panelTitle}>Mascotas perdidas</h2>
                <p className={styles.panelSubtitle}>Ayúdanos a encontrarlas</p>
              </div>
              {lostTop.length > 0 && (
                <Link href="/#mascotas" className={styles.panelLink}>Ver todas</Link>
              )}
            </header>

            {lostTop.length === 0 ? (
              <p className={styles.panelEmpty}>No hay reportes de mascotas perdidas activos ahora mismo.</p>
            ) : (
              <ul className={styles.panelList}>
                {lostTop.map((pet) => (
                  <li key={pet.publicId}>
                    <Link href={`/m/${pet.publicId}`} className={styles.miniCard}>
                      <span className={styles.miniThumb}>
                        {pet.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                          <img src={pet.photoUrl} alt={`Foto de ${pet.name}`} />
                        ) : (
                          <PawIcon size={20} />
                        )}
                      </span>
                      <span className={styles.miniBody}>
                        <span className={styles.miniName}>{pet.name}</span>
                        <span className={styles.miniMeta}>
                          <PinIcon size={12} /> {pet.city}
                          {pet.neighborhood ? ` · ${pet.neighborhood}` : ""}
                        </span>
                        <span className={styles.miniDate}>Reportada {relativeDate(pet.reportedAt)}</span>
                      </span>
                      <span className={`${styles.miniBadge} ${styles.miniBadgeLost}`}>Perdida</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          {/* -------- En adopción -------- */}
          <article className={`${styles.panel} ${styles.panelAdopt}`}>
            <header className={styles.panelHead}>
              <span className={styles.panelIcon} aria-hidden="true"><HeartIcon size={18} /></span>
              <div className={styles.panelHeadText}>
                <h2 className={styles.panelTitle}>En adopción</h2>
                <p className={styles.panelSubtitle}>Ellos también esperan un hogar</p>
              </div>
              {adoptionTop.length > 0 && (
                <Link href="/#adopciones" className={styles.panelLink}>Ver todas</Link>
              )}
            </header>

            {adoptionTop.length === 0 ? (
              <p className={styles.panelEmpty}>Todavía no hay mascotas publicadas para adopción.</p>
            ) : (
              <ul className={styles.panelList}>
                {adoptionTop.map((pet) => (
                  <li key={pet.publicId}>
                    <Link href={`/m/${pet.publicId}`} className={styles.miniCard}>
                      <span className={styles.miniThumb}>
                        {pet.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                          <img src={pet.photoUrl} alt={`Foto de ${pet.name}`} />
                        ) : (
                          <PawIcon size={20} />
                        )}
                      </span>
                      <span className={styles.miniBody}>
                        <span className={styles.miniName}>{pet.name}</span>
                        <span className={styles.miniMeta}>
                          {speciesLabel(pet.species, pet.speciesOther)}
                          {pet.breed ? ` · ${pet.breed}` : ""}
                        </span>
                      </span>
                      <span className={`${styles.miniBadge} ${styles.miniBadgeAdopt}`}>Adopción</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          {/* -------- Historias que inspiran -------- */}
          <article className={`${styles.panel} ${styles.panelStories}`}>
            <header className={styles.panelHead}>
              <span className={styles.panelIcon} aria-hidden="true"><BookIcon size={18} /></span>
              <div className={styles.panelHeadText}>
                <h2 className={styles.panelTitle}>Historias que inspiran</h2>
                <p className={styles.panelSubtitle}>Reencuentros de nuestra comunidad</p>
              </div>
            </header>

            {reunionsTop.length === 0 ? (
              <div className={styles.storiesEmpty}>
                <p className={styles.storiesEmptyText}>
                  Cuando un reporte de pérdida se cierra, el reencuentro aparece aquí. Cada historia
                  empieza con alguien que decide ayudar.
                </p>
                <Link href="/auth?mode=sign-up" className={styles.panelLink}>Registra a tu mascota</Link>
              </div>
            ) : (
              <ul className={styles.panelList}>
                {reunionsTop.map((reunion) => (
                  <li key={reunion.reportId} className={styles.storyRow}>
                    <span className={styles.storyMark} aria-hidden="true"><HeartIcon size={16} /></span>
                    <span className={styles.miniBody}>
                      <span className={styles.miniName}>
                        {speciesLabel(reunion.species, reunion.speciesOther)} de vuelta en casa
                      </span>
                      <span className={styles.miniMeta}>
                        <PinIcon size={12} /> {reunion.city}
                        {reunion.neighborhood ? ` · ${reunion.neighborhood}` : ""}
                      </span>
                      <span className={styles.miniDate}>Reunida {relativeDate(reunion.closedAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
