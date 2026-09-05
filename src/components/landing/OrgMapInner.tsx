"use client";

import { useMemo, useState } from "react";
import type { MapOrg } from "@/lib/map/orgMap";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/map/config";
import LeafletMap, { type LeafletMarker } from "@/components/map/LeafletMap";
import { buildOrgPopupHtml } from "@/components/map/markers";
import styles from "./landing.module.css";

type Filter = "todas" | "veterinaria" | "fundacion";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "veterinaria", label: "Veterinarias" },
  { value: "fundacion", label: "Fundaciones" },
];

/** `orgs` llega ya resuelto (fetch cacheado del lado del servidor en `MapSection`). */
export default function OrgMapInner({ orgs }: { orgs: MapOrg[] }) {
  const [filter, setFilter] = useState<Filter>("todas");

  const counts = useMemo(() => {
    const list = orgs;
    return {
      todas: list.length,
      veterinaria: list.filter((o) => o.kind === "veterinaria").length,
      fundacion: list.filter((o) => o.kind === "fundacion").length,
    };
  }, [orgs]);

  const markers = useMemo<LeafletMarker[]>(() => {
    return orgs
      .filter((o) => (filter === "todas" ? true : o.kind === filter))
      .map((o) => ({
        id: o.id,
        lat: o.lat,
        lng: o.lng,
        variant: o.kind,
        popupHtml: buildOrgPopupHtml(o),
      }));
  }, [orgs, filter]);

  return (
    <div className={styles.orgMap}>
      <div className={styles.orgMapBar}>
        <div className={styles.orgMapFilters} role="tablist" aria-label="Filtrar organizaciones del mapa">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={filter === f.value ? styles.orgMapFilterActive : styles.orgMapFilter}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span className={styles.orgMapFilterCount}>{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <div className={styles.orgMapLegend} aria-hidden="true">
          <span className={styles.orgMapLegendItem}>
            <span className={`${styles.orgMapDot} ${styles.orgMapDotVet}`} />Veterinaria
          </span>
          <span className={styles.orgMapLegendItem}>
            <span className={`${styles.orgMapDot} ${styles.orgMapDotFund}`} />Fundación
          </span>
        </div>
      </div>

      <div className={styles.orgMapCanvas}>
        <LeafletMap
          center={DEFAULT_MAP_CENTER}
          zoom={DEFAULT_MAP_ZOOM}
          markers={markers}
          fitToMarkers
          ariaLabel="Mapa de veterinarias y fundaciones aliadas"
        />
        {markers.length === 0 && (
          <p className={styles.orgMapEmpty}>
            {counts.todas === 0
              ? "Todavía no hay organizaciones aprobadas con ubicación en el mapa."
              : "No hay organizaciones de este tipo con ubicación registrada."}
          </p>
        )}
      </div>
    </div>
  );
}
