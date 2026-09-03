"use client";

import { useMemo } from "react";
import LeafletMap from "@/components/map/LeafletMap";
import {
  PICKER_FALLBACK_CENTER,
  PICKER_FALLBACK_ZOOM,
  isValidLatLng,
} from "@/lib/map/config";
import controls from "@/components/ui/controls.module.css";
import styles from "./orgLocationPicker.module.css";

interface OrgLocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  disabled?: boolean;
}

/**
 * Selector de ubicación de la SEDE de la organización (no la del propietario).
 * Solución sencilla y sin geocodificación: la organización coloca el pin en el
 * mapa (o escribe lat/lng) y ambos quedan sincronizados. Reutiliza `LeafletMap`.
 */
export default function OrgLocationPicker({ lat, lng, onChange, disabled }: OrgLocationPickerProps) {
  const valid = isValidLatLng(lat, lng);
  const incomplete = (lat !== null) !== (lng !== null);

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

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Marca en el mapa la ubicación exacta de tu sede (haz clic o arrastra el pin). Debe
        corresponder al establecimiento, no a tu domicilio.
      </p>

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
