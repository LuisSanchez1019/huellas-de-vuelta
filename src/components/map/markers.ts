import type * as L from "leaflet";
import type { MapOrg, MapOrgKind, MapOrgService } from "@/lib/map/orgMap";
import { buildDirectionsUrl } from "@/lib/map/directions";
import type { ServiceIconKey } from "@/lib/services/catalog";

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
const MARKER_GLYPH: Record<MapOrgKind | "pick", string> = {
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
    html: `<span class="hdv-marker hdv-marker--${variant}">${MARKER_GLYPH[variant]}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 30],
    popupAnchor: [0, -30],
  });
}

// ---- iconos de la tarjeta (línea, mismo estilo que Icon.tsx) ----
const IC = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10Z"/><circle cx="12" cy="11" r="2.2"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
} as const;

// Un icono de línea por cada clave del catálogo de servicios (mismos trazos
// que sus equivalentes en src/components/icons/Icon.tsx, en versión HTML
// cruda porque Leaflet inyecta el popup como string, no como React).
const SERVICE_ICON_SVG: Record<ServiceIconKey, string> = {
  stethoscope:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5v5.3a3.3 3.3 0 0 0 6.6 0V3.5"/><path d="M9.8 8.8v2.7a5.4 5.4 0 0 0 10.8 0V9.2"/><circle cx="20.6" cy="9.2" r="1.4"/><circle cx="15.2" cy="18.7" r="2.4"/></svg>',
  alert:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9.5v4"/><path d="M12 16.5h.01"/></svg>',
  syringe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6M16 6l-8.5 8.5a2 2 0 0 0 0 2.8L9 19a2 2 0 0 0 2.8 0L20 10.5"/><path d="M4 20l3-3M13 8l3 3M10.5 10.5l2.5 2.5"/></svg>',
  cross:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5h6v5.5H20.5v6H15v5.5H9V15H3.5V9H9V3.5Z"/></svg>',
  bed:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19v-6.5A1.5 1.5 0 0 1 4.5 11H10a2 2 0 0 1 2 2"/><path d="M12 13h7.5A1.5 1.5 0 0 1 21 14.5V19"/><path d="M3 16h18"/><path d="M3 19v1.5M21 19v1.5"/><rect x="4.5" y="12" width="3.4" height="2" rx=".6"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  tooth:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 3.5c-2.4 0-4 1.9-4 4.4 0 2.2.6 3.7 1.1 5.6.5 1.9.9 5 2.2 5 1.1 0 1.2-3.4 1.9-5 .4-.9.6-1.3 1.3-1.3s.9.4 1.3 1.3c.7 1.6.8 5 1.9 5 1.3 0 1.7-3.1 2.2-5 .5-1.9 1.1-3.4 1.1-5.6 0-2.5-1.6-4.4-4-4.4-1 0-1.7.4-2.5.8-.8-.4-1.5-.8-2.5-.8Z"/></svg>',
  scissors:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="2.3"/><circle cx="6.5" cy="17.5" r="2.3"/><path d="M8.3 8 20 19M8.3 16 20 5"/></svg>',
  pill:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.3" y="8.7" width="17.4" height="6.6" rx="3.3" transform="rotate(-35 12 12)"/><path d="M11 8.3 15.7 15.7"/></svg>',
  home:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5V14h4v5.5"/></svg>',
  tag:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5V5.5A1.5 1.5 0 0 1 5.5 4h7L20 11.5a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0L4 12.5Z"/><circle cx="8.5" cy="8.5" r="1.4"/></svg>',
  hand:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10m0 0V4.5a1.5 1.5 0 0 1 3 0V10m0 0V6a1.5 1.5 0 0 1 3 0v6.5c0 3.6-2.4 7-6.5 7-2.7 0-4.3-1.2-5.7-3.3l-2-3.2a1.5 1.5 0 0 1 2.4-1.8L8 12"/></svg>',
  heart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-9.2-8.6C1.3 8.5 2.8 5.5 6 5.5c2 0 3.3 1.1 4 2.3.7-1.2 2-2.3 4-2.3 3.2 0 4.7 3 3.2 5.9C19 15.6 12 20 12 20Z"/></svg>',
  activity:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3.4l2.1-6 3.6 12 2.2-9 1.6 3h4.1"/></svg>',
  bowl:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z"/><path d="M12 11V7.6"/><circle cx="12" cy="5.6" r="1.6"/></svg>',
  paw:
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="9" r="2.1"/><circle cx="12" cy="6.3" r="2.1"/><circle cx="17" cy="9" r="2.1"/><circle cx="19.2" cy="14" r="2.1"/><path d="M12 12c-3.1 0-6.3 2.3-6.3 5.4 0 1.8 1.5 2.9 3.1 2.4.9-.3 1.9-.3 2.9 0l.3.1.3-.1c1-.3 2-.3 2.9 0 1.6.5 3.1-.6 3.1-2.4C18.3 14.3 15.1 12 12 12z"/></svg>',
  report:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14.5 3.5V8h4"/><path d="M8.5 12.5h7M8.5 15.8h7M8.5 9.2h3"/></svg>',
  book:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"/></svg>',
};

/** Máximo de iconos de servicio visibles en la tarjeta antes de agrupar en "+N". */
const MAX_VISIBLE_SERVICES = 8;

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** "08:00" -> "8:00 a.m." */
function to12h(value: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return esc(value);
  let h = Number(m[1]);
  const min = m[2];
  const suffix = h < 12 ? "a.m." : "p.m.";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${suffix}`;
}

function hoursBlock(org: MapOrg): string {
  const open = org.hours.filter((h) => !h.closed && h.day).slice(0, 3);
  if (open.length === 0) return "";
  const lines = open
    .map((h) => {
      const range = h.open && h.close ? `${to12h(h.open)} – ${to12h(h.close)}` : "";
      return `${esc(h.day)}${range ? `: ${range}` : ""}`;
    })
    .join("<br>");
  return `<div class="hdv-pop__row"><span class="hdv-pop__ic">${IC.clock}</span><span class="hdv-pop__txt">${lines}</span></div>`;
}

/**
 * Fila de servicios de la tarjeta: SOLO iconos (sin nombre, para no ocupar
 * espacio en una etiqueta pensada para ser compacta). El nombre de cada
 * servicio aparece como tooltip nativo (`title`) al pasar el cursor. Si hay
 * más de `MAX_VISIBLE_SERVICES`, el resto se agrupa en un chip "+N" cuyo
 * tooltip lista los nombres restantes.
 */
function buildServicesBlock(services: MapOrgService[]): string {
  if (services.length === 0) return "";
  const visible = services.slice(0, MAX_VISIBLE_SERVICES);
  const overflow = services.slice(MAX_VISIBLE_SERVICES);

  const icons = visible
    .map(
      (s) =>
        `<span class="hdv-pop__srv-ic" title="${esc(s.name)}">${
          SERVICE_ICON_SVG[s.icon] ?? SERVICE_ICON_SVG.tag
        }</span>`,
    )
    .join("");
  const more =
    overflow.length > 0
      ? `<span class="hdv-pop__srv-more" title="${esc(overflow.map((s) => s.name).join(", "))}">+${overflow.length}</span>`
      : "";

  return `<p class="hdv-pop__srv-title">Servicios principales</p><div class="hdv-pop__srv">${icons}${more}</div>`;
}

function directionsUrl(org: MapOrg): string {
  return buildDirectionsUrl(org.mapUrl, org.lat, org.lng) ?? "";
}

/**
 * HTML de la tarjeta del marcador con SOLO información pública: logo, nombre,
 * tipo, descripción, zona, dirección, horario, teléfono y servicios. No incluye
 * correo, datos del responsable ni estado de aprobación (la RPC ni los devuelve).
 */
export function buildOrgPopupHtml(org: MapOrg): string {
  const logo = org.logoUrl
    ? `<img class="hdv-pop__logo-img" src="${esc(org.logoUrl)}" alt="" loading="lazy" />`
    : `<span class="hdv-pop__logo-fb">${esc(initialsFor(org.name))}</span>`;

  const place = [org.neighborhood, org.city].filter(Boolean).map(esc).join(" · ");
  const addressBlock =
    org.address || place
      ? `<div class="hdv-pop__row"><span class="hdv-pop__ic">${IC.pin}</span><span class="hdv-pop__txt">${
          org.address ? esc(org.address) : ""
        }${org.address && place ? "<br>" : ""}${
          place ? `<span class="hdv-pop__muted">${place}</span>` : ""
        }</span></div>`
      : "";

  const phoneBlock = org.phone
    ? `<div class="hdv-pop__row"><span class="hdv-pop__ic">${IC.phone}</span><a class="hdv-pop__phone" href="tel:${esc(
        org.phone.replace(/[^\d+]/g, ""),
      )}">${esc(org.phone)}</a></div>`
    : "";

  const servicesBlock = buildServicesBlock(org.services);

  const rows = `${addressBlock}${hoursBlock(org)}${phoneBlock}`;

  return `
    <div class="hdv-pop">
      <div class="hdv-pop__head">
        <span class="hdv-pop__logo">${logo}</span>
        <div class="hdv-pop__id">
          <span class="hdv-pop__badge">${esc(KIND_LABEL[org.kind]).toUpperCase()}</span>
          <p class="hdv-pop__name">${esc(org.name)}</p>
          ${org.description ? `<p class="hdv-pop__tagline">${esc(org.description)}</p>` : ""}
        </div>
      </div>
      ${rows ? `<div class="hdv-pop__rows">${rows}</div>` : ""}
      ${servicesBlock ? `<div class="hdv-pop__div"></div>${servicesBlock}` : ""}
      <a class="hdv-pop__btn" href="${esc(directionsUrl(org))}" target="_blank" rel="noopener noreferrer">
        Cómo llegar <span class="hdv-pop__btn-ic">${IC.chevron}</span>
      </a>
    </div>`;
}
