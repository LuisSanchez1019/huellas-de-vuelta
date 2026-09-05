/**
 * Nombres de los tags de caché pública (usados por `unstable_cache` en
 * `publicCache.ts`, por la ruta `/api/internal/revalidate` y por
 * `triggerPublicRevalidate`). En un archivo aparte porque este último se
 * importa desde código de cliente ("use client") y no puede arrastrar
 * `next/cache` (solo servidor).
 */
export const PUBLIC_ORGS_TAG = "public-orgs";
export const PUBLIC_LOST_PETS_TAG = "public-lost-pets";

/**
 * Pide invalidar un tag de caché pública, sin bloquear al llamador (fire and
 * forget: no se espera la respuesta ni se propaga el error — si falla, el
 * dato simplemente se refresca solo al vencer la ventana de tiempo del
 * caché). Se llama DESPUÉS de que la mutación principal ya se guardó y
 * respondió, nunca antes.
 */
export function triggerPublicRevalidate(tag: string): void {
  if (typeof fetch !== "function") return;
  fetch("/api/internal/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
    keepalive: true,
  }).catch(() => {
    /* mejor esfuerzo: el TTL del caché es la red de seguridad */
  });
}
