import { ClockIcon, PawIcon, PhoneIcon, PinIcon, ServiceIcon, WhatsAppIcon } from "@/components/icons/Icon";
import { orgCategoryLabels, type OrgCategory } from "@/lib/pets/reencuentro";
import type { OrgServiceRef } from "@/lib/supabase/orgProfiles";
import type { OrgProfileKind } from "@/lib/supabase/orgProfiles";
import type { ServiceIconKey } from "@/lib/services/catalog";
import { whatsappLink } from "@/lib/phone";
import { buildDirectionsUrl } from "@/lib/map/directions";
import { to12h } from "@/lib/time";
import { CardMapLink } from "./MapLinks";
import styles from "./landing.module.css";

export interface OrgCardHours {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

export interface OrgCardData {
  id: string;
  name: string;
  category: OrgCategory;
  logoUrl: string | null;
  description: string;
  city: string;
  neighborhood: string;
  address: string;
  phone: string;
  whatsapp: string;
  hours: OrgCardHours[];
  mapUrl: string | null;
  lat: number | null;
  lng: number | null;
  services: OrgServiceRef[];
}

const MAX_VISIBLE_SERVICES = 4;

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function OrgCard({
  org,
  featured = false,
  kind,
}: {
  org: OrgCardData;
  featured?: boolean;
  kind?: OrgProfileKind;
}) {
  const location = [org.city, org.neighborhood].filter(Boolean).join(" · ");
  const openHours = org.hours.filter((h) => !h.closed && h.day).slice(0, 2);
  const whatsapp = whatsappLink(org.whatsapp) ?? whatsappLink(org.phone);
  const directions = buildDirectionsUrl(org.mapUrl, org.lat, org.lng);
  const hasCoords = org.lat != null && org.lng != null;
  const mapKind: OrgProfileKind =
    kind ?? (org.category === "veterinaria" ? "veterinaria" : "fundacion");
  const services = org.services.slice(0, MAX_VISIBLE_SERVICES);
  const extraServices = org.services.length - services.length;

  return (
    <article className={`${styles.orgCard} ${featured ? styles.orgCardFeatured : ""}`} role="listitem">
      <div className={styles.orgHead}>
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo público servido desde Supabase Storage
          <img src={org.logoUrl} alt={`Logo de ${org.name}`} className={styles.orgLogo} />
        ) : (
          <span className={styles.orgLogoFallback} aria-hidden="true">{monogram(org.name) || <PawIcon size={20} />}</span>
        )}
        <div className={styles.orgHeadText}>
          <span className={styles.orgTagRow}>
            <span className={styles.orgTag}>{orgCategoryLabels[org.category]}</span>
            {featured && <span className={styles.orgFeaturedTag}>Destacado</span>}
          </span>
          <p className={styles.orgName}>{org.name}</p>
        </div>
      </div>

      {location && (
        <p className={styles.orgLine}>
          <PinIcon size={13} /> <span>{location}</span>
        </p>
      )}
      {org.address && (
        <p className={styles.orgLine}>
          <PinIcon size={13} /> <span>{org.address}</span>
        </p>
      )}
      {openHours.length > 0 && (
        <p className={styles.orgLine}>
          <ClockIcon size={13} />
          <span>
            {openHours
              .map((h) => (h.open && h.close ? `${h.day}: ${to12h(h.open)} – ${to12h(h.close)}` : h.day))
              .join(" · ")}
          </span>
        </p>
      )}
      {org.phone && (
        <p className={styles.orgLine}>
          <PhoneIcon size={13} /> <span>{org.phone}</span>
        </p>
      )}
      {org.description && <p className={styles.orgDesc}>{org.description}</p>}

      {services.length > 0 && (
        <div className={styles.orgServices} title={services.map((s) => s.name).join(", ")}>
          {services.map((service) => (
            <span key={service.slug} className={styles.orgServiceIcon} title={service.name}>
              <ServiceIcon icon={service.icon as ServiceIconKey} size={14} />
            </span>
          ))}
          {extraServices > 0 && (
            <span className={styles.orgServiceMore} title={org.services.slice(MAX_VISIBLE_SERVICES).map((s) => s.name).join(", ")}>
              +{extraServices}
            </span>
          )}
        </div>
      )}

      {(whatsapp || hasCoords || directions) && (
        <div className={styles.orgActions}>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.orgActionWhatsapp}
              aria-label={`Escribir a ${org.name} por WhatsApp`}
              title={`Escribir a ${org.name} por WhatsApp`}
            >
              <WhatsAppIcon size={14} /> WhatsApp
            </a>
          )}
          {hasCoords && <CardMapLink orgId={org.id} kind={mapKind} />}
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.orgActionMaps}
              aria-label={`Abrir la ubicación de ${org.name} en Google Maps`}
              title={`Abrir la ubicación de ${org.name} en Google Maps`}
            >
              <PinIcon size={14} /> Google Maps
            </a>
          )}
        </div>
      )}
    </article>
  );
}
