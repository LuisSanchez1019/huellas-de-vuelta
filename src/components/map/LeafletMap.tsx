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
 * sin recrearlo. El tema claro/oscuro lo resuelve `leaflet-theme.css`.
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
        attributionControl: true,
      });
      map.on("mouseover", () => map.scrollWheelZoom.enable());
      map.on("mouseout", () => map.scrollWheelZoom.disable());

      leaflet
        .tileLayer(MAP_TILES.url, { attribution: MAP_TILES.attribution, maxZoom: MAP_TILES.maxZoom })
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
    for (const m of markers) {
      leaflet
        .marker([m.lat, m.lng], { icon: buildOrgDivIcon(leaflet, m.variant), keyboard: true })
        .bindPopup(m.popupHtml ?? "", { closeButton: true, minWidth: 240, maxWidth: 260 })
        .addTo(layer);
    }

    if (fitToMarkers && markers.length > 0) {
      const bounds = leaflet.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.2), { maxZoom: 15, animate: false });
    }
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
      map.setView(pos, Math.max(map.getZoom(), 14), { animate: false });
    } else {
      pickPinRef.current.setLatLng(pos);
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
