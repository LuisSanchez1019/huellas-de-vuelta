import type * as L from "leaflet";
import type { MapOrg, MapOrgKind } from "@/lib/map/orgMap";

/** Escapa texto para inyectarlo con seguridad en el HTML del popup/divIcon. */
function esc(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const KIND_LABEL: Record<MapOrgKind, string> = {
  veterinaria: "Veterinaria",
  fundacion: "Fundación",
};

// Glifos de línea (sin emojis), coherentes con src/components/icons/Icon.tsx.
const GLYPH: Record<MapOrgKind | "pick", string> = {
  veterinaria:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>',
  fundacion:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"/></svg>',
  pick:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10Z"/><circle cx="12" cy="11" r="2"/></svg>',
};

/** Icono de marcador para una organización (o para el selector de ubicación). */
export function buildOrgDivIcon(leaflet: typeof L, variant: MapOrgKind | "pick"): L.DivIcon {
  return leaflet.divIcon({
    className: "hdv-marker-wrap",
    html: `<span class="hdv-marker hdv-marker--${variant}">${GLYPH[variant]}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 30],
    popupAnchor: [0, -28],
  });
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function hoursLine(org: MapOrg): string {
  const open = org.hours.filter((h) => !h.closed && h.day);
  if (open.length === 0) return "";
  const first = open[0];
  const extra = open.length > 1 ? ` +${open.length - 1}` : "";
  const range = first.open && first.close ? ` ${esc(first.open)}–${esc(first.close)}` : "";
  return `<p class="hdv-popup__row"><strong>Horario</strong> ${esc(first.day)}${range}${extra}</p>`;
}

/**
 * HTML del popup con SOLO información pública: logo, nombre, tipo, ciudad/zona,
 * dirección, horario, teléfono y servicios. No incluye correo, datos del
 * responsable ni estado de aprobación (la RPC ni siquiera los devuelve).
 */
export function buildOrgPopupHtml(org: MapOrg): string {
  const place = [org.neighborhood, org.city].filter(Boolean).map(esc).join(" · ");
  const logo = org.logoUrl
    ? `<img class="hdv-popup__logo" src="${esc(org.logoUrl)}" alt="" loading="lazy" />`
    : `<span class="hdv-popup__logo hdv-popup__logo--fallback">${esc(initialsFor(org.name))}</span>`;

  const services = org.services.slice(0, 4);
  const servicesHtml =
    services.length > 0
      ? `<div class="hdv-popup__services">${services
          .map((s) => `<span class="hdv-popup__chip">${esc(s)}</span>`)
          .join("")}</div>`
      : "";

  const phoneHtml = org.phone
    ? `<p class="hdv-popup__row"><strong>Teléfono</strong> ${esc(org.phone)}</p>`
    : "";
  const addressHtml = org.address
    ? `<p class="hdv-popup__row"><strong>Dirección</strong> ${esc(org.address)}</p>`
    : "";
  const mapLink = org.mapUrl
    ? `<a class="hdv-popup__link" href="${esc(org.mapUrl)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>`
    : "";

  return `
    <div class="hdv-popup">
      <div class="hdv-popup__head">
        ${logo}
        <div>
          <p class="hdv-popup__name">${esc(org.name)}</p>
          <span class="hdv-popup__type">${esc(KIND_LABEL[org.kind])}</span>
        </div>
      </div>
      ${place ? `<p class="hdv-popup__row"><strong>Zona</strong> ${place}</p>` : ""}
      ${addressHtml}
      ${hoursLine(org)}
      ${phoneHtml}
      ${servicesHtml}
      ${mapLink}
    </div>`;
}
