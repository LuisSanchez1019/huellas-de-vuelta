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

const SRV_GLYPH = {
  paw: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="9" r="2.1"/><circle cx="12" cy="6.3" r="2.1"/><circle cx="17" cy="9" r="2.1"/><circle cx="19.2" cy="14" r="2.1"/><path d="M12 12c-3.1 0-6.3 2.3-6.3 5.4 0 1.8 1.5 2.9 3.1 2.4.9-.3 1.9-.3 2.9 0l.3.1.3-.1c1-.3 2-.3 2.9 0 1.6.5 3.1-.6 3.1-2.4C18.3 14.3 15.1 12 12 12z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-9.2-8.6C1.3 8.5 2.8 5.5 6 5.5c2 0 3.3 1.1 4 2.3.7-1.2 2-2.3 4-2.3 3.2 0 4.7 3 3.2 5.9C19 15.6 12 20 12 20Z"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5h6v5.5H20.5v6H15v5.5H9V15H3.5V9H9V3.5Z"/></svg>',
  syringe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6M16 6l-8.5 8.5a2 2 0 0 0 0 2.8L9 19a2 2 0 0 0 2.8 0L20 10.5"/><path d="M4 20l3-3M13 8l3 3M10.5 10.5l2.5 2.5"/></svg>',
  bowl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z"/><path d="M12 11V7.6"/><circle cx="12" cy="5.6" r="1.6"/></svg>',
} as const;

function serviceGlyph(name: string): string {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (/(rescat|adop|hogar|acogida|padrin|apadrin)/.test(n)) return SRV_GLYPH.heart;
  if (/(vacun|desparasit|inyec|jeringa|atencion basic)/.test(n)) return SRV_GLYPH.syringe;
  if (/(cirug|urgenc|medic|salud|clinic|consulta|laboratorio|castr|esteriliz|hospital)/.test(n))
    return SRV_GLYPH.cross;
  if (/(aliment|comida|nutric|croqueta|concentrado)/.test(n)) return SRV_GLYPH.bowl;
  return SRV_GLYPH.paw;
}

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

function directionsUrl(org: MapOrg): string {
  if (org.mapUrl) return org.mapUrl;
  return `https://www.google.com/maps/search/?api=1&query=${org.lat},${org.lng}`;
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

  const services = org.services.slice(0, 4);
  const servicesBlock =
    services.length > 0
      ? `<p class="hdv-pop__srv-title">Servicios principales</p>
         <div class="hdv-pop__srv">${services
           .map(
             (s) =>
               `<span class="hdv-pop__srv-item"><span class="hdv-pop__srv-box">${serviceGlyph(
                 s,
               )}</span><span class="hdv-pop__srv-label">${esc(s)}</span></span>`,
           )
           .join("")}</div>`
      : "";

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
