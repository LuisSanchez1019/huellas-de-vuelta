/** Ruta de la página pública de una mascota (a la que apunta su QR). */
export const PUBLIC_PET_PATH = "/m";

/**
 * URL completa que codifica el QR de una mascota. Solo contiene el identificador
 * público de la mascota; nunca datos del propietario.
 */
export function petPublicUrl(publicId: string, origin: string): string {
  return `${origin}${PUBLIC_PET_PATH}/${publicId}`;
}
