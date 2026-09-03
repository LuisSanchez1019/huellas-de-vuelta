"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchMapOrganizations, type MapOrg } from "@/lib/map/orgMap";
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

export default function OrgMapInner() {
  const [orgs, setOrgs] = useState<MapOrg[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<Filter>("todas");
  const fetchedRef = useRef(false);

  // Una sola consulta pública, al montar. No se repite al cambiar el filtro ni el tema.
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const supabase = createSupabaseBrowserClient();
    fetchMapOrganizations(supabase)
      .then((rows) => {
        setOrgs(rows);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const counts = useMemo(() => {
    const list = orgs ?? [];
    return {
      todas: list.length,
      veterinaria: list.filter((o) => o.kind === "veterinaria").length,
      fundacion: list.filter((o) => o.kind === "fundacion").length,
    };
  }, [orgs]);

  const markers = useMemo<LeafletMarker[]>(() => {
    if (!orgs) return [];
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
        {status === "ready" && markers.length === 0 && (
          <p className={styles.orgMapEmpty}>
            {counts.todas === 0
              ? "Todavía no hay organizaciones aprobadas con ubicación en el mapa."
              : "No hay organizaciones de este tipo con ubicación registrada."}
          </p>
        )}
        {status === "error" && (
          <p className={styles.orgMapEmpty}>No fue posible cargar el mapa. Inténtalo más tarde.</p>
        )}
      </div>
    </div>
  );
}
