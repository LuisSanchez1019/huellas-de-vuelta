/**
 * URL de "Ver en Google Maps" a partir de los MISMOS datos de ubicación que
 * ya guarda la organización (nunca se crea ni duplica una coordenada nueva):
 * prioriza el enlace de mapa que la organización haya registrado, y si no
 * hay, construye una búsqueda de Google Maps con sus coordenadas. `null`
 * cuando no hay ninguno de los dos (no se muestra el botón).
 */
export function buildDirectionsUrl(
  mapUrl: string | null,
  lat: number | null,
  lng: number | null,
): string | null {
  if (mapUrl) return mapUrl;
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return null;
}
