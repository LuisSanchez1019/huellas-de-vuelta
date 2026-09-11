"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MapOrg } from "@/lib/map/orgMap";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/map/config";
import LeafletMap, { type LeafletMarker } from "@/components/map/LeafletMap";
import MapOrgPanel from "./MapOrgPanel";
import { subscribeMapFocus } from "./mapFocus";
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
  // Hover / foco = selección transitoria; clic / teclado = selección fija.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);
  const orgByIdRef = useRef(orgById);
  useEffect(() => {
    orgByIdRef.current = orgById;
  }, [orgById]);

  const counts = useMemo(
    () => ({
      todas: orgs.length,
      veterinaria: orgs.filter((o) => o.kind === "veterinaria").length,
      fundacion: orgs.filter((o) => o.kind === "fundacion").length,
    }),
    [orgs],
  );

  const visibleOrgs = useMemo(
    () => (filter === "todas" ? orgs : orgs.filter((o) => o.kind === filter)),
    [orgs, filter],
  );

  const markers = useMemo<LeafletMarker[]>(
    () =>
      visibleOrgs.map((o) => ({
        id: o.id,
        lat: o.lat,
        lng: o.lng,
        variant: o.kind,
        label: `${o.kind === "veterinaria" ? "Veterinaria" : "Fundación"}: ${o.name}`,
      })),
    [visibleOrgs],
  );

  const activeId = pinnedId ?? hoverId;
  const selectedOrg =
    activeId && visibleOrgs.some((o) => o.id === activeId) ? orgById.get(activeId) ?? null : null;

  // "Ver en el mapa" de las secciones / tarjetas.
  useEffect(() => {
    return subscribeMapFocus(({ kind, orgId }) => {
      if (orgId) {
        const org = orgByIdRef.current.get(orgId);
        if (org) {
          setFilter((current) =>
            current !== "todas" && current !== org.kind ? "todas" : current,
          );
          setHoverId(null);
          setPinnedId(orgId);
          return;
        }
      }
      if (kind) {
        setFilter(kind);
        setHoverId(null);
        setPinnedId(null);
      }
    });
  }, []);

  function changeFilter(next: Filter) {
    setFilter(next);
    setHoverId(null);
    setPinnedId(null);
  }

  return (
    <div className={styles.orgMap}>
      <div className={styles.orgMapControls}>
        <div className={styles.orgMapFilters} role="tablist" aria-label="Filtrar organizaciones del mapa">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={filter === f.value ? styles.orgMapFilterActive : styles.orgMapFilter}
              onClick={() => changeFilter(f.value)}
            >
              {f.label}
              <span className={styles.orgMapFilterCount}>{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <p className={styles.orgMapHint}>
          Selecciona un marcador —con el ratón, con un toque o con el teclado— para ver su información
          y su contacto en el panel.
        </p>
      </div>

      <div className={styles.orgMapGrid}>
        <div className={styles.orgMapCanvas}>
          <LeafletMap
            center={DEFAULT_MAP_CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            markers={markers}
            fitToMarkers
            onMarkerActivate={setHoverId}
            onMarkerDeactivate={() => setHoverId(null)}
            onMarkerSelect={(id) => setPinnedId((current) => (current === id ? null : id))}
            activeMarkerId={activeId}
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

        <MapOrgPanel org={selectedOrg} />
      </div>
    </div>
  );
}
