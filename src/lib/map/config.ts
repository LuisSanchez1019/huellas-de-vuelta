/**
 * Configuración del proveedor de mapas/tiles.
 *
 * Toda la app consume el mapa a través de `LeafletMap`, que lee esta config.
 * Para cambiar de proveedor (MapTiler, Mapbox raster, tiles propios…) basta con
 * editar `MAP_TILES`: la lógica de organizaciones y de marcadores no depende de
 * estos valores.
 */
export interface TileLayerConfig {
  /** Plantilla de URL para tema claro. */
  light: string;
  /** Plantilla de URL para tema oscuro. */
  dark: string;
  attribution: string;
  subdomains: string;
  maxZoom: number;
}

/**
 * CARTO basemaps ("Positron" claro / "Dark Matter" oscuro): mapa plano y
 * minimalista, sin relieve ni sombreado de terreno, tierra en un tono uniforme.
 * Sin clave de API. Cada tema tiene su propio juego de tiles (no se invierte).
 */
export const MAP_TILES: TileLayerConfig = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap &copy; CARTO",
  subdomains: "abcd",
  maxZoom: 20,
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
