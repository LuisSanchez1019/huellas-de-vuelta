import { ChatIcon, PawIcon, PhoneIcon, PinIcon } from "@/components/icons/Icon";
import { orgCategoryLabels, type OrgCategory } from "@/lib/pets/reencuentro";
import styles from "./landing.module.css";

export interface OrgCardData {
  id: string;
  name: string;
  category: OrgCategory;
  logoUrl: string | null;
  description: string;
  city: string;
  neighborhood: string;
  phone: string;
  whatsapp: string;
  services: string[];
}

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function OrgCard({ org }: { org: OrgCardData }) {
  const location = [org.city, org.neighborhood].filter(Boolean).join(" · ");
  const services = org.services.slice(0, 4);

  return (
    <article className={styles.orgCard} role="listitem">
      <div className={styles.orgHead}>
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo público servido desde Supabase Storage
          <img src={org.logoUrl} alt={`Logo de ${org.name}`} className={styles.orgLogo} />
        ) : (
          <span className={styles.orgLogoFallback} aria-hidden="true">{monogram(org.name) || <PawIcon size={20} />}</span>
        )}
        <div className={styles.orgHeadText}>
          <span className={styles.orgTag}>{orgCategoryLabels[org.category]}</span>
          <p className={styles.orgName}>{org.name}</p>
        </div>
      </div>

      {location && (
        <p className={styles.orgLine}>
          <PinIcon size={13} /> <span>{location}</span>
        </p>
      )}
      {org.description && <p className={styles.orgDesc}>{org.description}</p>}

      {(org.phone || org.whatsapp) && (
        <p className={styles.orgLine}>
          {org.phone ? (
            <>
              <PhoneIcon size={13} /> <span>{org.phone}</span>
            </>
          ) : (
            <>
              <ChatIcon size={13} /> <span>{org.whatsapp}</span>
            </>
          )}
        </p>
      )}

      {services.length > 0 && (
        <div className={styles.orgServices}>
          {services.map((service) => (
            <span key={service} className={styles.orgService}>{service}</span>
          ))}
        </div>
      )}
    </article>
  );
}
