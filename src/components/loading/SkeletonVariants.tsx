import type { ReactElement } from "react";
import Skeleton from "./Skeleton";
import styles from "./SkeletonVariants.module.css";

/**
 * Variantes de skeleton que imitan la estructura real de cada tipo de
 * pantalla (proporciones y jerarquía tomadas de `dashboardHome.module.css`,
 * `petsList.module.css`, `controls.module.css` y `dataTable.module.css` — no
 * son bloques genéricos).
 *
 * Cada variante se expone en dos formas:
 * - `*Skeleton` (con encabezado fantasma incluido): para `RouteLoading`,
 *   cuando reemplaza la pantalla completa (nada real se ha pintado todavía).
 * - `*SkeletonBody` (sin encabezado): para cuando un componente ya está
 *   montado dentro de una página que YA pintó su encabezado real — así el
 *   estado de carga interno de ese componente no dibuja un segundo
 *   encabezado fantasma debajo del real.
 */
export type SkeletonVariant = "dashboard" | "list" | "profile" | "form" | "table" | "generic";

export function PageHeadSkeleton() {
  return (
    <div className={styles.pageHead}>
      <Skeleton className={styles.titleBar} />
      <Skeleton className={styles.subtitleBar} />
    </div>
  );
}

export function DashboardSkeletonBody() {
  return (
    <div>
      <div className={styles.statGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.statCard}>
            <Skeleton circle width="2.75rem" height="2.75rem" />
            <div>
              <Skeleton className={styles.statValue} />
              <Skeleton className={styles.statLabel} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.actionRow}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className={styles.actionPill} />
        ))}
      </div>
    </div>
  );
}

function PetCard() {
  return (
    <div className={styles.petCard}>
      <Skeleton className={styles.petPhoto} />
      <div className={styles.petMain}>
        <Skeleton className={styles.petName} />
        <Skeleton className={styles.petInfoLine} width="45%" />
        <Skeleton className={styles.petInfoLine} width="60%" />
        <div className={styles.petFooter}>
          <Skeleton className={styles.petBadge} />
          <div className={styles.petActions}>
            <Skeleton className={styles.petActionBar} />
            <Skeleton className={styles.petActionBar} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListSkeletonBody({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.listGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <PetCard key={i} />
      ))}
    </div>
  );
}

export function ProfileSkeletonBody() {
  return (
    <div>
      <div className={styles.identityRow}>
        <Skeleton className={styles.avatar} circle />
        <div className={styles.identityLines}>
          <Skeleton className={styles.identityName} />
          <Skeleton className={styles.identitySub} />
        </div>
      </div>

      {[3, 2].map((fieldCount, sectionIndex) => (
        <div key={sectionIndex} className={styles.section}>
          <Skeleton className={styles.sectionTitleBar} />
          <div className={styles.sectionBody}>
            {Array.from({ length: fieldCount }).map((_, i) => (
              <div key={i} className={styles.fieldGroup}>
                <Skeleton className={styles.fieldLabelBar} />
                <Skeleton className={styles.fieldInputBar} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormSkeletonBody() {
  return (
    <div>
      <div className={styles.section}>
        <Skeleton className={styles.sectionTitleBar} />
        <div className={styles.sectionBody}>
          <div className={styles.fieldRow2}>
            <div className={styles.fieldGroup}>
              <Skeleton className={styles.fieldLabelBar} />
              <Skeleton className={styles.fieldInputBar} />
            </div>
            <div className={styles.fieldGroup}>
              <Skeleton className={styles.fieldLabelBar} />
              <Skeleton className={styles.fieldInputBar} />
            </div>
          </div>
          <div className={styles.fieldGroup}>
            <Skeleton className={styles.fieldLabelBar} />
            <Skeleton className={styles.fieldInputBar} />
          </div>
          <div className={styles.fieldGroup}>
            <Skeleton className={styles.fieldLabelBar} />
            <Skeleton className={styles.fieldInputBar} height="4.5rem" />
          </div>
        </div>
      </div>
      <div className={styles.buttonRow}>
        <Skeleton className={styles.buttonBar} />
      </div>
    </div>
  );
}

export function TableSkeletonBody({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      <div className={styles.toolbarRow}>
        <Skeleton className={styles.searchBar} />
        <Skeleton className={styles.filterPill} />
        <Skeleton className={styles.filterPill} />
      </div>
      <div className={styles.tableWrap}>
        <div className={styles.tableHeadRow}>
          <Skeleton className={`${styles.cellBar} ${styles.cellWide}`} height=".7rem" />
          <Skeleton className={`${styles.cellBar} ${styles.cellMed}`} height=".7rem" />
          <Skeleton className={`${styles.cellBar} ${styles.cellMed}`} height=".7rem" />
          <Skeleton className={`${styles.cellBar} ${styles.cellNarrow}`} height=".7rem" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={styles.tableRow}>
            <Skeleton className={`${styles.cellBar} ${styles.cellWide}`} width={`${70 - (i % 5) * 4}%`} />
            <Skeleton className={`${styles.cellBar} ${styles.cellMed}`} width="60%" />
            <Skeleton className={`${styles.cellBar} ${styles.cellMed}`} width="45%" />
            <Skeleton className={`${styles.cellBar} ${styles.cellNarrow}`} width="70%" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GenericSkeletonBody() {
  return (
    <div>
      <div className={styles.genericCard}>
        <Skeleton className={styles.bannerBar} />
        <Skeleton className={styles.textLine} width="80%" />
        <Skeleton className={styles.textLine} width="60%" />
      </div>
      <div className={styles.genericCard}>
        <Skeleton className={styles.textLine} width="40%" />
        <Skeleton className={styles.textLine} width="90%" />
        <Skeleton className={styles.textLine} width="70%" />
      </div>
    </div>
  );
}

const BODY_BY_VARIANT: Record<SkeletonVariant, () => ReactElement> = {
  dashboard: () => <DashboardSkeletonBody />,
  list: () => <ListSkeletonBody />,
  profile: () => <ProfileSkeletonBody />,
  form: () => <FormSkeletonBody />,
  table: () => <TableSkeletonBody />,
  generic: () => <GenericSkeletonBody />,
};

/** Variante completa (encabezado fantasma + cuerpo) — usada por `RouteLoading`. */
export const SKELETON_VARIANTS: Record<SkeletonVariant, () => ReactElement> = Object.fromEntries(
  (Object.keys(BODY_BY_VARIANT) as SkeletonVariant[]).map((variant) => {
    const Body = BODY_BY_VARIANT[variant];
    return [
      variant,
      () => (
        <div>
          <PageHeadSkeleton />
          <Body />
        </div>
      ),
    ];
  }),
) as Record<SkeletonVariant, () => ReactElement>;
