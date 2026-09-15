import Link from "next/link";
import { HandIcon } from "@/components/icons/Icon";
import { getCachedActiveAllies } from "@/lib/supabase/publicCache";
import AllyCard from "./AllyCard";
import SectionTitle from "./SectionTitle";
import styles from "./landing.module.css";

/**
 * "Empresas que apoyan la causa" — aliados cuya empresa tiene visibilidad
 * vigente Y autorización de publicación otorgada (RPC
 * `list_public_active_allies`: organización aprobada+activa, con una
 * solicitud de visibilidad con pago CONFIRMADO por un administrador y dentro
 * de fecha, y con `organization_authorizations` (public_info) vigente — ver
 * `aliado_visibility_orders`). Sin mocks: si nadie cumple todas las
 * condiciones, se muestra el estado vacío. Al vencer el período contratado o
 * al retirar la autorización, la organización deja de aparecer aquí
 * automáticamente.
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
            <p className={styles.sponsorsEmptyTitle}>Aún estamos construyendo nuestra red de aliados.</p>
            <p className={styles.sponsorsEmptyText}>
              Pronto encontrarás aquí las empresas que se han unido a Huellas de Vuelta para apoyar
              nuestra misión.
            </p>
            <Link className={styles.sponsorsEmptyCta} href="/auth/aliado">Quiero ser aliado</Link>
          </div>
        ) : (
          <ul className={styles.alliesGrid}>
            {allies.map((ally) => (
              <AllyCard key={ally.id} ally={ally} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
