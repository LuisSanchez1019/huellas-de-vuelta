/**
 * Nombres de los tags de caché pública (usados por `unstable_cache` en
 * `publicCache.ts`, por la ruta `/api/internal/revalidate` y por
 * `triggerPublicRevalidate`). En un archivo aparte porque este último se
 * importa desde código de cliente ("use client") y no puede arrastrar
 * `next/cache` (solo servidor).
 */
export const PUBLIC_ORGS_TAG = "public-orgs";
export const PUBLIC_LOST_PETS_TAG = "public-lost-pets";
export const PUBLIC_ADOPTIONS_TAG = "public-adoptions";
export const PUBLIC_STATS_TAG = "public-stats";
export const PUBLIC_POSTERS_TAG = "public-posters";

/** Todos los tags públicos que la ruta de revalidación acepta. */
export const PUBLIC_CACHE_TAGS = [
  PUBLIC_ORGS_TAG,
  PUBLIC_LOST_PETS_TAG,
  PUBLIC_ADOPTIONS_TAG,
  PUBLIC_STATS_TAG,
  PUBLIC_POSTERS_TAG,
] as const;

/**
 * Pide invalidar uno o varios tags de caché pública, sin bloquear al
 * llamador (fire and forget: no se espera la respuesta ni se propaga el
 * error — si falla, el dato simplemente se refresca solo al vencer la
 * ventana de tiempo del caché). Se llama DESPUÉS de que la mutación
 * principal ya se guardó y respondió, nunca antes.
 */
export function triggerPublicRevalidate(tag: string | readonly string[]): void {
  if (typeof fetch !== "function") return;
  const tags = Array.isArray(tag) ? tag : [tag];
  for (const t of tags) {
    fetch("/api/internal/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: t }),
      keepalive: true,
    }).catch(() => {
      /* mejor esfuerzo: el TTL del caché es la red de seguridad */
    });
  }
}
