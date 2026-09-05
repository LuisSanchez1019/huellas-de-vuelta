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
  popupHtml?: string;
}

interface LeafletMapProps {
  center: [number, number];
  zoom: number;
  markers?: LeafletMarker[];
  /** Ajusta el encuadre para que quepan todos los marcadores. */
  fitToMarkers?: boolean;
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
  picker,
  className,
  ariaLabel = "Mapa",
}: LeafletMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const pickPinRef = useRef<L.Marker | null>(null);
  const pickerOnChangeRef = useRef<((lat: number, lng: number) => void) | undefined>(undefined);

  const [ready, setReady] = useState(false);
  const isPicker = Boolean(picker);
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);

  // Mantener el callback del picker actualizado sin recrear el mapa.
  useEffect(() => {
    pickerOnChangeRef.current = picker?.onChange;
  }, [picker?.onChange]);

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
      // Atribución mínima obligatoria por licencia, sin la marca "Leaflet".
      leaflet.control.attribution({ prefix: false }).addTo(map);

      map.on("mouseover", () => map.scrollWheelZoom.enable());
      map.on("mouseout", () => map.scrollWheelZoom.disable());
      // Leaflet escala visualmente todos los paneles (tiles, marcadores, popups)
      // durante la animación de zoom; una tarjeta abierta se ve "estirarse" o
      // deformarse mientras dura. Cerrarla al iniciar el zoom evita ese efecto.
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
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
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
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
    const CLOSE_DELAY_MS = 220;

    for (const m of markers) {
      const marker = leaflet
        .marker([m.lat, m.lng], { icon: buildOrgDivIcon(leaflet, m.variant), keyboard: true })
        .bindPopup(m.popupHtml ?? "", {
          closeButton: true,
          minWidth: 264,
          maxWidth: 300,
          autoPan: true,
          className: "hdv-popup-wrap",
        })
        .addTo(layer);

      // Abrir al pasar el ratón (además del clic/toque) y cerrar sola en cuanto
      // el cursor deja tanto el marcador como la tarjeta. Un pequeño margen de
      // tiempo permite moverse del uno al otro sin que se cierre de golpe.
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
      // La tarjeta es el mismo nodo del DOM en cada apertura (bindPopup lo
      // reutiliza): basta con engancharle los listeners una sola vez.
      marker.on("popupopen", (e: L.PopupEvent) => {
        const el = e.popup.getElement();
        if (el && !el.dataset.hdvHoverBound) {
          el.dataset.hdvHoverBound = "1";
          el.addEventListener("mouseenter", cancelClose);
          el.addEventListener("mouseleave", scheduleClose);
        }
      });
    }

    if (fitToMarkers && markers.length > 0) {
      const bounds = leaflet.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.2), { maxZoom: 15, animate: false });
    }

    return () => {
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
    };
  }, [ready, markers, fitToMarkers]);

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
      // Si el nuevo punto queda fuera de la vista (p. ej. tras una búsqueda de
      // dirección), reencuadra. Un arrastre pequeño no dispara esto.
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
