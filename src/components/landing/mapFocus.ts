/**
 * Puente ligero entre las secciones del Landing y el mapa (`OrgMapInner`).
 *
 * "Ver en el mapa" (secciones Veterinarias/Fundaciones y tarjetas) no depende
 * de coordenadas ni de rutas nuevas: hace scroll suave hasta el ancla estable
 * `#mapa` y avisa al mapa —vía un `CustomEvent`— qué filtro aplicar o qué
 * organización seleccionar. Si el mapa aún no está montado (carga perezosa), se
 * suscribe igual y aplicará el foco en cuanto reciba el evento.
 */

export const MAP_ANCHOR_ID = "mapa";
const EVENT = "hdv:map-focus";

export type MapKindFilter = "veterinaria" | "fundacion";

export interface MapFocusDetail {
  kind?: MapKindFilter;
  orgId?: string;
}

function scrollToMap(): void {
  if (typeof document === "undefined") return;
  const node = document.getElementById(MAP_ANCHOR_ID);
  if (!node) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  // Mantener la URL compartible sin provocar un salto brusco extra.
  try {
    history.replaceState(null, "", `#${MAP_ANCHOR_ID}`);
  } catch {
    /* algunos navegadores en modo estricto lo bloquean: no es crítico */
  }
}

/** Lleva al mapa y activa el filtro del tipo indicado (sección Veterinarias / Fundaciones). */
export function focusMapByKind(kind: MapKindFilter): void {
  scrollToMap();
  window.dispatchEvent(new CustomEvent<MapFocusDetail>(EVENT, { detail: { kind } }));
}

/** Lleva al mapa y selecciona la organización indicada (botón de una tarjeta). */
export function focusMapByOrg(orgId: string, kind?: MapKindFilter): void {
  scrollToMap();
  window.dispatchEvent(new CustomEvent<MapFocusDetail>(EVENT, { detail: { orgId, kind } }));
}

/** El mapa se suscribe para reaccionar a los eventos anteriores. Devuelve el `unsubscribe`. */
export function subscribeMapFocus(handler: (detail: MapFocusDetail) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<MapFocusDetail>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
