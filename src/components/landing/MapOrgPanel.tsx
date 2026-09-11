"use client";

import { ClockIcon, MapIcon, PhoneIcon, PinIcon, ServiceIcon, WhatsAppIcon } from "@/components/icons/Icon";
import type { MapOrg } from "@/lib/map/orgMap";
import type { ServiceIconKey } from "@/lib/services/catalog";
import { whatsappLink } from "@/lib/phone";
import { buildDirectionsUrl } from "@/lib/map/directions";
import { to12h } from "@/lib/time";
import styles from "./landing.module.css";

const KIND_LABEL = { veterinaria: "Veterinaria", fundacion: "Fundación" } as const;

function monogram(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * Panel de información del mapa. Los datos son EXACTAMENTE los que ya trae la
 * RPC pública (`MapOrg`) — no se duplica ni se inventa nada. Sin selección
 * muestra un estado neutro con la instrucción de uso.
 */
export default function MapOrgPanel({ org }: { org: MapOrg | null }) {
  if (!org) {
    return (
      <aside className={styles.mapPanel} aria-live="polite">
        <div className={styles.mapPanelEmpty}>
          <span className={styles.mapPanelEmptyIcon} aria-hidden="true">
            <MapIcon size={24} />
          </span>
          <p className={styles.mapPanelEmptyTitle}>Sin organización seleccionada</p>
          <p className={styles.mapPanelEmptyText}>
            Selecciona una veterinaria o fundación en el mapa —con el ratón, con un toque o con el
            teclado— para ver aquí su información y su contacto.
          </p>
        </div>
      </aside>
    );
  }

  const place = [org.neighborhood, org.city].filter(Boolean).join(" · ");
  const openHours = org.hours.filter((h) => !h.closed && h.day).slice(0, 3);
  const whatsapp = whatsappLink(org.whatsapp) ?? whatsappLink(org.phone);
  const directions = buildDirectionsUrl(org.mapUrl, org.lat, org.lng);
  const services = org.services.slice(0, 8);
  const phoneHref = org.phone ? `tel:${org.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <aside className={styles.mapPanel} aria-live="polite">
      <div className={styles.mapPanelHead}>
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo público de Supabase Storage
          <img src={org.logoUrl} alt={`Logo de ${org.name}`} className={styles.mapPanelLogo} />
        ) : (
          <span className={styles.mapPanelLogoFallback} aria-hidden="true">
            {monogram(org.name)}
          </span>
        )}
        <div className={styles.mapPanelId}>
          <span className={styles.mapPanelBadge}>{KIND_LABEL[org.kind]}</span>
          <p className={styles.mapPanelName}>{org.name}</p>
        </div>
      </div>

      {org.description && <p className={styles.mapPanelDesc}>{org.description}</p>}

      <div className={styles.mapPanelRows}>
        {(org.address || place) && (
          <p className={styles.mapPanelRow}>
            <PinIcon size={14} />
            <span>
              {org.address}
              {org.address && place ? <br /> : null}
              {place && <span className={styles.mapPanelMuted}>{place}</span>}
            </span>
          </p>
        )}
        {openHours.length > 0 && (
          <p className={styles.mapPanelRow}>
            <ClockIcon size={14} />
            <span>
              {openHours
                .map((h) => (h.open && h.close ? `${h.day}: ${to12h(h.open)} – ${to12h(h.close)}` : h.day))
                .join(" · ")}
            </span>
          </p>
        )}
        {org.phone && (
          <p className={styles.mapPanelRow}>
            <PhoneIcon size={14} />
            {phoneHref ? (
              <a href={phoneHref} className={styles.mapPanelPhone}>
                {org.phone}
              </a>
            ) : (
              <span>{org.phone}</span>
            )}
          </p>
        )}
      </div>

      {services.length > 0 && (
        <div className={styles.mapPanelServices}>
          <p className={styles.mapPanelServicesTitle}>Servicios principales</p>
          <div className={styles.mapPanelServiceRow}>
            {services.map((s) => (
              <span key={s.slug} className={styles.mapPanelServiceIcon} title={s.name}>
                <ServiceIcon icon={s.icon as ServiceIconKey} size={15} />
              </span>
            ))}
          </div>
        </div>
      )}

      {(whatsapp || directions) && (
        <div className={styles.mapPanelActions}>
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
    </aside>
  );
}
