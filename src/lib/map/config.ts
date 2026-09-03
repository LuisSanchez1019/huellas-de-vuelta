/**
 * Configuración del proveedor de mapas/tiles.
 *
 * Toda la app consume el mapa a través de `LeafletMap`, que lee esta config.
 * Para cambiar de proveedor (Carto, MapTiler, Mapbox raster, tiles propios…)
 * basta con editar `MAP_TILES`: la lógica de organizaciones y de marcadores no
 * depende de estos valores.
 */
export interface TileLayerConfig {
  url: string;
  attribution: string;
  maxZoom: number;
  /** Si el proveedor no ofrece variante oscura, se aplica un filtro CSS al panel de tiles. */
  darkMode: "css-filter" | "native";
}

/** OpenStreetMap estándar: sin clave de API, sin coste, suficiente para el Landing. */
export const MAP_TILES: TileLayerConfig = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
  darkMode: "css-filter",
};

/** Centro por defecto del mapa del Landing (Colombia — Bucaramanga y área metropolitana). */
export const DEFAULT_MAP_CENTER: [number, number] = [7.1193, -73.1227];
export const DEFAULT_MAP_ZOOM = 12;

/** Encuadre inicial del selector de ubicación cuando la organización aún no tiene coordenadas. */
export const PICKER_FALLBACK_CENTER: [number, number] = [4.5709, -74.2973]; // Colombia
export const PICKER_FALLBACK_ZOOM = 5;

export function isValidLatLng(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}
