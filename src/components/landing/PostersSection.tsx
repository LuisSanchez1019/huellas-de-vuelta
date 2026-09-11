import { MegaphoneIcon } from "@/components/icons/Icon";
import { getCachedLandingPosters } from "@/lib/supabase/publicCache";
import PosterSlider from "./PosterSlider";
import styles from "./posters.module.css";

/**
 * Server component: trae hasta 4 posters vigentes (RPC pública cacheada, ventana
 * corta + revalidación por tag). Va INMEDIATAMENTE DESPUÉS del bloque principal
 * (Hero) y ANTES de "Mascotas perdidas". Si no hay posters vigentes no renderiza
 * nada — sin caja vacía, sin espacios verticales de más.
 */
export default async function PostersSection() {
  const posters = await getCachedLandingPosters().catch(() => []);
  if (posters.length === 0) return null;

  return (
    <section id="posters" className={styles.section} aria-label="Posters de organizaciones aliadas">
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>
            <MegaphoneIcon size={14} /> Tablón aliado
          </p>
          <h2 className={styles.title}>Novedades de nuestras organizaciones</h2>
        </div>
        <PosterSlider posters={posters} />
      </div>
    </section>
  );
}
