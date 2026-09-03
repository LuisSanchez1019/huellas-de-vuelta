"use client";

import { useMemo, useState } from "react";
import LeafletMap from "@/components/map/LeafletMap";
import {
  PICKER_FALLBACK_CENTER,
  PICKER_FALLBACK_ZOOM,
  isValidLatLng,
} from "@/lib/map/config";
import { SearchIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "./orgLocationPicker.module.css";

interface OrgLocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  disabled?: boolean;
  /** Datos de la dirección ya escritos en el formulario, para la búsqueda rápida. */
  address?: string;
  city?: string;
  neighborhood?: string;
}

type SearchState = "idle" | "loading" | "notfound" | "error";

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Selector de ubicación de la SEDE de la organización (no la del propietario).
 *
 * Tres formas de fijar el punto, de la más rápida a la más precisa:
 *  1. Escribir la dirección (ciudad, departamento…) y pulsar "Buscar": se
 *     geocodifica con Nominatim (OpenStreetMap, sin clave) y el pin se coloca solo.
 *  2. Hacer clic o arrastrar el pin en el mapa.
 *  3. Escribir latitud/longitud a mano.
 * Los tres quedan sincronizados. Reutiliza `LeafletMap`.
 */
export default function OrgLocationPicker({
  lat,
  lng,
  onChange,
  disabled,
  address = "",
  city = "",
  neighborhood = "",
}: OrgLocationPickerProps) {
  const valid = isValidLatLng(lat, lng);
  const incomplete = (lat !== null) !== (lng !== null);

  const suggestedQuery = useMemo(
    () => [address, neighborhood, city].map((s) => s.trim()).filter(Boolean).join(", "),
    [address, neighborhood, city],
  );
  const [typedQuery, setTypedQuery] = useState<string | null>(null);
  const query = typedQuery ?? suggestedQuery;
  const [searchState, setSearchState] = useState<SearchState>("idle");

  const center = useMemo<[number, number]>(
    () => (valid ? [lat as number, lng as number] : PICKER_FALLBACK_CENTER),
    [valid, lat, lng],
  );
  const zoom = valid ? 15 : PICKER_FALLBACK_ZOOM;

  function setLat(value: string) {
    onChange(value === "" ? null : Number(value), lng);
  }
  function setLng(value: string) {
    onChange(lat, value === "" ? null : Number(value));
  }

  async function search() {
    const q = query.trim();
    if (!q || disabled) return;
    setSearchState("loading");
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=co" +
        "&accept-language=es&q=" +
        encodeURIComponent(q);
      const res = await fetch(url);
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      const hit = Array.isArray(data) ? data[0] : undefined;
      if (hit && Number.isFinite(Number(hit.lat)) && Number.isFinite(Number(hit.lon))) {
        onChange(round(Number(hit.lat)), round(Number(hit.lon)));
        setSearchState("idle");
      } else {
        setSearchState("notfound");
      }
    } catch {
      setSearchState("error");
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Escribe la dirección con ciudad y departamento y pulsa <strong>Buscar</strong> para colocar
        el pin automáticamente. Después puedes ajustarlo arrastrándolo. Debe corresponder al
        establecimiento, no a tu domicilio.
      </p>

      <div className={styles.searchRow}>
        <input
          className={controls.input}
          value={query}
          onChange={(e) => {
            setTypedQuery(e.target.value);
            if (searchState !== "idle") setSearchState("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Cra 27 #36-10, Bucaramanga, Santander"
          disabled={disabled}
        />
        <button
          type="button"
          className={controls.buttonSecondary}
          onClick={() => void search()}
          disabled={disabled || searchState === "loading" || !query.trim()}
        >
          <SearchIcon size={16} />
          {searchState === "loading" ? "Buscando…" : "Buscar"}
        </button>
      </div>
      {searchState === "notfound" && (
        <p className={controls.errorText}>
          No se encontró esa dirección. Ajústala o marca el punto directamente en el mapa.
        </p>
      )}
      {searchState === "error" && (
        <p className={controls.errorText}>
          No se pudo buscar la dirección. Inténtalo de nuevo o marca el punto en el mapa.
        </p>
      )}

      <div className={styles.mapBox} aria-disabled={disabled}>
        <LeafletMap
          center={center}
          zoom={zoom}
          picker={{
            position: valid ? [lat as number, lng as number] : null,
            onChange: (nextLat, nextLng) => onChange(nextLat, nextLng),
          }}
          ariaLabel="Selecciona la ubicación de la organización en el mapa"
        />
      </div>

      <div className={controls.row2}>
        <label className={controls.field}>
          Latitud
          <input
            className={controls.input}
            type="number"
            step="any"
            inputMode="decimal"
            value={lat ?? ""}
            onChange={(e) => setLat(e.target.value)}
            placeholder="7.1193"
            disabled={disabled}
          />
        </label>
        <label className={controls.field}>
          Longitud
          <input
            className={controls.input}
            type="number"
            step="any"
            inputMode="decimal"
            value={lng ?? ""}
            onChange={(e) => setLng(e.target.value)}
            placeholder="-73.1227"
            disabled={disabled}
          />
        </label>
      </div>

      <div className={styles.footer}>
        {valid ? (
          <button
            type="button"
            className={controls.buttonSecondary}
            onClick={() => onChange(null, null)}
            disabled={disabled}
          >
            Quitar ubicación
          </button>
        ) : (
          <span />
        )}
        {incomplete && (
          <p className={controls.errorText}>Indica latitud y longitud, o deja ambas vacías.</p>
        )}
        {!incomplete && !valid && (lat !== null || lng !== null) && (
          <p className={controls.errorText}>Las coordenadas no son válidas.</p>
        )}
        {valid && (
          <p className={styles.ok}>Ubicación lista para el mapa del Landing (tras la aprobación).</p>
        )}
      </div>
    </div>
  );
}
