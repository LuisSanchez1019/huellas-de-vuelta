import Link from "next/link";
import { HandIcon } from "@/components/icons/Icon";
import { getCachedActiveAllies } from "@/lib/supabase/publicCache";
import SectionTitle from "./SectionTitle";
import styles from "./landing.module.css";

/**
 * "Empresas que apoyan la causa" — aliados cuya empresa tiene visibilidad
 * vigente (RPC `list_public_active_allies`: organización aprobada+activa y con
 * una solicitud de visibilidad con pago CONFIRMADO por un administrador y
 * dentro de fecha — ver `aliado_visibility_orders`). Sin mocks: si nadie tiene
 * visibilidad vigente, se muestra el estado vacío. Al vencer el período
 * contratado, la organización deja de aparecer aquí automáticamente.
 */
export default async function SponsorsSection() {
  const allies = await getCachedActiveAllies().catch(() => []);

  return (
    <section id="empresas" className={`${styles.section} ${styles.sectionAlt}`} aria-label="Empresas que apoyan la causa">
      <div className={styles.sectionInner}>
        <SectionTitle
          eyebrow="Aliados comerciales"
          title="Empresas que apoyan la causa"
          subtitle="Gracias a nuestros aliados podemos seguir trabajando para ayudar a más mascotas."
        />
        {allies.length === 0 ? (
          <div className={styles.sponsorsEmpty}>
            <span className={styles.sponsorsEmptyIcon} aria-hidden="true"><HandIcon size={26} /></span>
            <p className={styles.sponsorsEmptyTitle}>Este espacio es para las empresas que apoyan a Huellas de Vuelta</p>
            <p className={styles.sponsorsEmptyText}>
              Aún no hay aliados comerciales publicados. Si tu empresa quiere apoyar la plataforma y
              aparecer aquí, únete como aliado.
            </p>
            <Link className={styles.sponsorsEmptyCta} href="/auth/aliado">Quiero ser aliado</Link>
          </div>
        ) : (
          <ul className={styles.alliesGrid}>
            {allies.map((ally) => (
              <li key={ally.id} className={styles.allyCard}>
                {ally.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo público de Supabase Storage
                  <img src={ally.logoUrl} alt={ally.name} className={styles.allyLogo} />
                ) : (
                  <span className={styles.allyLogoPlaceholder} aria-hidden="true"><HandIcon size={22} /></span>
                )}
                <span className={styles.allyName}>{ally.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
