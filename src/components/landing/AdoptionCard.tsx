import Link from "next/link";
import { ChatIcon, PawIcon, PinIcon } from "@/components/icons/Icon";
import styles from "./landing.module.css";

export interface AdoptionItem {
  key: string;
  name: string;
  photoUrl: string | null;
  meta: string;
  city: string | null;
  badge: "adopcion" | "padrino";
  org: { name: string; kindLabel: string; logoUrl: string | null } | null;
  href: string | null;
  hrefLabel: string;
  external: boolean;
}

const BADGE_LABEL: Record<AdoptionItem["badge"], string> = {
  adopcion: "En adopción",
  padrino: "Busca padrino",
};

function monogram(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function AdoptionCard({ item }: { item: AdoptionItem }) {
  return (
    <article className={styles.petItemCard} role="listitem">
      <div className={styles.petItemPhoto}>
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
          <img src={item.photoUrl} alt={`Foto de ${item.name}`} />
        ) : (
          <span className={styles.petItemPhotoFallback} aria-hidden="true"><PawIcon size={34} /></span>
        )}
        <span
          className={`${styles.petItemBadge} ${item.badge === "padrino" ? styles.petItemBadgeSponsor : styles.petItemBadgeAdopt}`}
        >
          {BADGE_LABEL[item.badge]}
        </span>
      </div>

      <div className={styles.petItemBody}>
        <p className={styles.petItemName}>{item.name}</p>
        <p className={styles.petItemMeta}>{item.meta}</p>
        {item.city && (
          <p className={styles.petItemLine}>
            <PinIcon size={12} /> <span>{item.city}</span>
          </p>
        )}

        {item.org && (
          <div className={styles.petItemOrg}>
            {item.org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo público de Supabase Storage
              <img src={item.org.logoUrl} alt="" className={styles.petItemOrgLogo} />
            ) : (
              <span className={styles.petItemOrgLogoFallback} aria-hidden="true">{monogram(item.org.name)}</span>
            )}
            <span className={styles.petItemOrgText}>
              <span className={styles.petItemOrgKind}>{item.org.kindLabel}</span>
              <span className={styles.petItemOrgName}>{item.org.name}</span>
            </span>
          </div>
        )}

        {item.href ? (
          item.external ? (
            <a
              className={styles.petItemCta}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ChatIcon size={14} /> {item.hrefLabel}
            </a>
          ) : (
            <Link className={styles.petItemCta} href={item.href}>{item.hrefLabel}</Link>
          )
        ) : (
          <span className={styles.petItemCtaMuted}>{item.hrefLabel}</span>
        )}
      </div>
    </article>
  );
}
