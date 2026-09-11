"use client";

import { MapIcon, PinIcon } from "@/components/icons/Icon";
import { focusMapByKind, focusMapByOrg, type MapKindFilter } from "./mapFocus";
import styles from "./landing.module.css";

/**
 * "Ver en el mapa" de la cabecera de las secciones Veterinarias / Fundaciones:
 * baja al mapa (scroll suave, ancla `#mapa`) y activa el filtro del tipo.
 */
export function SectionMapLink({ kind }: { kind: MapKindFilter }) {
  return (
    <button type="button" className={styles.viewAllLink} onClick={() => focusMapByKind(kind)}>
      <MapIcon size={15} /> Ver en el mapa
    </button>
  );
}

/**
 * "Ver en el mapa" de una tarjeta de organización: baja al mapa y selecciona
 * ese punto (rellenando el panel de información). Solo se renderiza cuando la
 * organización tiene coordenadas válidas — nunca se inventa una ubicación.
 */
export function CardMapLink({ orgId, kind }: { orgId: string; kind: MapKindFilter }) {
  return (
    <button
      type="button"
      className={styles.orgActionMap}
      onClick={() => focusMapByOrg(orgId, kind)}
      title="Ver la ubicación en el mapa de Huellas de Vuelta"
    >
      <PinIcon size={14} /> Ver en el mapa
    </button>
  );
}
