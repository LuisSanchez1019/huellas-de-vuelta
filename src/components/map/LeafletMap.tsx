"use client";

import { useEffect, useRef, useState } from "react";
import type * as L from "leaflet";
import { MAP_TILES } from "@/lib/map/config";
import { buildOrgDivIcon } from "./markers";
import type { MapOrgKind } from "@/lib/map/orgMap";
import "leaflet/dist/leaflet.css";
import "./leaflet-theme.css";

export interface LeafletMarker {
  id: string;
  lat: number;
  lng: number;
  variant: MapOrgKind;
  /** Nombre accesible del marcador (para teclado / lector de pantalla). */
  label?: string;
  /** HTML de la tarjeta emergente. Solo se usa si NO se pasa `onMarkerActivate`. */
  popupHtml?: string;
}

interface LeafletMapProps {
  center: [number, number];
  zoom: number;
  markers?: LeafletMarker[];
  /** Ajusta el encuadre para que quepan todos los marcadores. */
  fitToMarkers?: boolean;
  /**
   * Modo "panel": en vez de abrir una tarjeta dentro del mapa, notifica al
   * contenedor qué organización se está consultando (hover / foco / clic /
   * toque) para que la muestre en un panel aparte. Cuando se pasa esta prop, los
   * marcadores NO abren popup.
   */
  onMarkerActivate?: (id: string) => void;
  /** Se dispara al salir de un marcador con el ratón o al perder el foco. */
  onMarkerDeactivate?: () => void;
  /** Selección "fija": clic o Enter/Espacio sobre un marcador. */
  onMarkerSelect?: (id: string) => void;
  /** Marcador resaltado (y al que el mapa hace un paneo suave si queda fuera de vista). */
  activeMarkerId?: string | null;
  /** Modo selector de ubicación: pin arrastrable + clic para colocar. */
  picker?: {
    position: [number, number] | null;
    onChange: (lat: number, lng: number) => void;
  };
  className?: string;
  ariaLabel?: string;
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6; // ~0,1 m de precisión
}

/**
 * Envoltorio ligero sobre Leaflet. Carga la librería de forma perezosa
 * (`import("leaflet")`) para que no entre en el bundle inicial del Landing.
 * El mapa se crea UNA vez; los marcadores y el pin del selector se actualizan
 * sin recrearlo. Un solo juego de tiles; el tema lo resuelve `leaflet-theme.css`.
 */
export default function LeafletMap({
  center,
  zoom,
  markers,
  fitToMarkers = false,
  onMarkerActivate,
  onMarkerDeactivate,
  onMarkerSelect,
  activeMarkerId = null,
  picker,
  className,
  ariaLabel = "Mapa",
}: LeafletMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const markerIndexRef = useRef<Map<string, L.Marker>>(new Map());
  const pickPinRef = useRef<L.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pickerOnChangeRef = useRef<((lat: number, lng: number) => void) | undefined>(undefined);
  const activateRef = useRef<((id: string) => void) | undefined>(undefined);
  const deactivateRef = useRef<(() => void) | undefined>(undefined);
  const selectRef = useRef<((id: string) => void) | undefined>(undefined);

  const [ready, setReady] = useState(false);
  const isPicker = Boolean(picker);
  const panelMode = Boolean(onMarkerActivate);
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    pickerOnChangeRef.current = picker?.onChange;
  }, [picker?.onChange]);
  useEffect(() => {
    activateRef.current = onMarkerActivate;
    deactivateRef.current = onMarkerDeactivate;
    selectRef.current = onMarkerSelect;
  }, [onMarkerActivate, onMarkerDeactivate, onMarkerSelect]);

  // ---- crear el mapa una sola vez ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const mod = await import("leaflet");
      const leaflet = (mod.default ?? mod) as unknown as typeof L;
      if (cancelled || !hostRef.current || mapRef.current) return;

      leafletRef.current = leaflet;
      const map = leaflet.map(hostRef.current, {
        center: centerRef.current,
        zoom: zoomRef.current,
        scrollWheelZoom: false, // no "secuestra" el scroll del Landing
        zoomControl: true,
        attributionControl: false,
      });
      leaflet.control.attribution({ prefix: false }).addTo(map);

      map.on("mouseover", () => map.scrollWheelZoom.enable());
      map.on("mouseout", () => map.scrollWheelZoom.disable());
      map.on("zoomstart", () => map.closePopup());

      leaflet
        .tileLayer(MAP_TILES.url, {
          attribution: MAP_TILES.attribution,
          subdomains: MAP_TILES.subdomains ?? "abc",
          maxZoom: MAP_TILES.maxZoom,
        })
        .addTo(map);

      markerLayerRef.current = leaflet.layerGroup().addTo(map);

      if (isPicker) {
        map.on("click", (e: L.LeafletMouseEvent) => {
          pickerOnChangeRef.current?.(round(e.latlng.lat), round(e.latlng.lng));
        });
      }

      mapRef.current = map;
      if (!cancelled) setReady(true);

      // El mapa vive en una rejilla que cambia de tamaño (responsive, panel
      // lateral). Sin esto, Leaflet conserva el ancho con el que se creó y las
      // tiles/tamaño quedan desalineados tras un cambio de viewport.
      if (typeof ResizeObserver !== "undefined" && hostRef.current) {
        let raf = 0;
        const ro = new ResizeObserver(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => mapRef.current?.invalidateSize({ animate: false }));
        });
        ro.observe(hostRef.current);
        resizeObserverRef.current = ro;
      }
    })();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      markerIndexRef.current = new Map();
      pickPinRef.current = null;
      leafletRef.current = null;
    };
  }, [isPicker]);

  // ---- marcadores ----
  useEffect(() => {
    const leaflet = leafletRef.current;
    const layer = markerLayerRef.current;
    const map = mapRef.current;
    if (!ready || !leaflet || !layer || !map || !markers) return;

    layer.clearLayers();
    markerIndexRef.current = new Map();
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
    const CLOSE_DELAY_MS = 220;

    for (const m of markers) {
      const marker = leaflet
        .marker([m.lat, m.lng], { icon: buildOrgDivIcon(leaflet, m.variant), keyboard: true })
        .addTo(layer);
      markerIndexRef.current.set(m.id, marker);

      if (panelMode) {
        // ---- modo panel: sin popup; hover / foco / clic / toque -> contenedor ----
        let closeTimer: ReturnType<typeof setTimeout> | null = null;
        const scheduleDeactivate = () => {
          if (closeTimer) clearTimeout(closeTimer);
          closeTimer = setTimeout(() => {
            pendingTimers.delete(closeTimer as ReturnType<typeof setTimeout>);
            deactivateRef.current?.();
          }, CLOSE_DELAY_MS);
          pendingTimers.add(closeTimer);
        };
        const cancelDeactivate = () => {
          if (closeTimer) {
            clearTimeout(closeTimer);
            pendingTimers.delete(closeTimer);
            closeTimer = null;
          }
        };

        marker.on("mouseover", () => {
          cancelDeactivate();
          activateRef.current?.(m.id);
        });
        marker.on("mouseout", scheduleDeactivate);
        marker.on("click", () => {
          cancelDeactivate();
          selectRef.current?.(m.id);
        });

        const el = marker.getElement();
        if (el) {
          el.setAttribute("role", "button");
          el.setAttribute("aria-label", m.label ?? "Ver organización en el panel");
          el.setAttribute("title", m.label ?? "");
          el.addEventListener("focus", () => {
            cancelDeactivate();
            activateRef.current?.(m.id);
          });
          el.addEventListener("blur", scheduleDeactivate);
          el.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              cancelDeactivate();
              selectRef.current?.(m.id);
            }
          });
        }
      } else {
        // ---- modo tarjeta emergente (compatibilidad) ----
        marker.bindPopup(m.popupHtml ?? "", {
          closeButton: true,
          minWidth: 264,
          maxWidth: 300,
          autoPan: true,
          className: "hdv-popup-wrap",
        });

        let closeTimer: ReturnType<typeof setTimeout> | null = null;
        const cancelClose = () => {
          if (closeTimer) {
            clearTimeout(closeTimer);
            pendingTimers.delete(closeTimer);
            closeTimer = null;
          }
        };
        const scheduleClose = () => {
          cancelClose();
          closeTimer = setTimeout(() => {
            pendingTimers.delete(closeTimer as ReturnType<typeof setTimeout>);
            marker.closePopup();
          }, CLOSE_DELAY_MS);
          pendingTimers.add(closeTimer);
        };

        marker.on("mouseover", () => {
          cancelClose();
          marker.openPopup();
        });
        marker.on("mouseout", scheduleClose);
        marker.on("popupopen", (e: L.PopupEvent) => {
          const el = e.popup.getElement();
          if (el && !el.dataset.hdvHoverBound) {
            el.dataset.hdvHoverBound = "1";
            el.addEventListener("mouseenter", cancelClose);
            el.addEventListener("mouseleave", scheduleClose);
          }
        });
      }
    }

    if (fitToMarkers && markers.length > 0) {
      const bounds = leaflet.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.25), { maxZoom: 15, animate: false });
    }

    return () => {
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
    };
  }, [ready, markers, fitToMarkers, panelMode]);

  // ---- resaltado + paneo suave del marcador activo (modo panel) ----
  useEffect(() => {
    if (!ready || !panelMode) return;
    const map = mapRef.current;
    const index = markerIndexRef.current;
    if (!map) return;

    for (const [id, marker] of index) {
      const el = marker.getElement();
      if (!el) continue;
      const isActive = id === activeMarkerId;
      el.classList.toggle("hdv-marker-wrap--active", isActive);
      marker.setZIndexOffset(isActive ? 1000 : 0);
    }

    if (activeMarkerId) {
      const marker = index.get(activeMarkerId);
      if (marker) {
        const point = marker.getLatLng();
        if (!map.getBounds().pad(-0.18).contains(point)) {
          map.panTo(point, { animate: true, duration: 0.4 });
        }
      }
    }
  }, [ready, panelMode, activeMarkerId, markers]);

  // ---- pin del selector ----
  const pickLat = picker?.position?.[0] ?? null;
  const pickLng = picker?.position?.[1] ?? null;
  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !leaflet || !map || !isPicker) return;

    if (pickLat === null || pickLng === null) {
      pickPinRef.current?.remove();
      pickPinRef.current = null;
      return;
    }
    const pos: [number, number] = [pickLat, pickLng];
    if (!pickPinRef.current) {
      const pin = leaflet
        .marker(pos, { icon: buildOrgDivIcon(leaflet, "pick"), draggable: true })
        .addTo(map);
      pin.on("dragend", () => {
        const { lat, lng } = pin.getLatLng();
        pickerOnChangeRef.current?.(round(lat), round(lng));
      });
      pickPinRef.current = pin;
      map.setView(pos, Math.max(map.getZoom(), 15), { animate: false });
    } else {
      pickPinRef.current.setLatLng(pos);
      if (!map.getBounds().pad(-0.15).contains(pos)) {
        map.setView(pos, Math.max(map.getZoom(), 15), { animate: false });
      }
    }
  }, [ready, isPicker, pickLat, pickLng]);

  return (
    <div
      ref={hostRef}
      className={`hdv-map ${className ?? ""}`}
      role="application"
      aria-label={ariaLabel}
    />
  );
}
