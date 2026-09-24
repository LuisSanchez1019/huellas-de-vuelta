/**
 * Errores de las RPC del Bloque D. La BD responde con CÓDIGOS cortos
 * (`raise exception 'ACCESS_DENIED'`); aquí se traducen a mensajes.
 * Deliberadamente genéricos: no distinguen "no existe" de "no es tuyo".
 */

const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Debes iniciar sesión.",
  VET_NOT_AUTHORIZED: "Esta función es solo para veterinarias aprobadas.",
  RATE_LIMITED: "Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.",
  PET_NOT_FOUND: "No encontramos este identificador.",
  ACCESS_DENIED: "No tienes un acceso vigente a esta ficha.",
  PERMISSION_DENIED: "Tu autorización no incluye esta acción.",
  ACCESS_NOT_FOUND: "No encontramos esa solicitud.",
  NOT_ACTIVE: "Este acceso ya no está activo.",
  REQUEST_EXPIRED: "Esta solicitud venció. Pide una nueva.",
  TOO_MANY_REQUESTS: "Ya se enviaron varias solicitudes para esta mascota. Inténtalo más tarde.",
  REASON_TOO_SHORT: "Escribe un motivo de al menos 10 caracteres.",
  FIELD_REQUIRED: "Falta un campo obligatorio.",
  FIELD_TOO_SHORT: "Uno de los textos es demasiado corto.",
  FIELD_TOO_LONG: "Uno de los textos es demasiado largo.",
  INVALID_VALUE: "Alguno de los valores está fuera del rango permitido.",
  INVALID_MEDICATIONS: "Revisa los medicamentos: hay un dato no válido.",
  INVALID_PERMISSIONS: "Los permisos seleccionados no son válidos.",
  INVALID_DURATION: "La duración seleccionada no es válida.",
  INVALID_DECISION: "La decisión no es válida.",
  INVALID_METHOD: "Método de identificación no válido.",
  REQUEST_ID_IN_USE: "No se pudo registrar. Recarga la página e inténtalo de nuevo.",
  REQUEST_ID_REQUIRED: "No se pudo registrar. Recarga la página e inténtalo de nuevo.",
  ITEM_NOT_FOUND: "No encontramos ese registro.",
};

const FALLBACK = "No fue posible completar la operación. Inténtalo de nuevo.";

export function vetErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message).trim();
  }
  return null;
}

export function vetErrorMessage(error: unknown): string {
  const code = vetErrorCode(error);
  return (code && MESSAGES[code]) || FALLBACK;
}

/** El acceso se perdió (revocado, vencido o inexistente): la pantalla debe bloquearse. */
export function isAccessLost(error: unknown): boolean {
  return vetErrorCode(error) === "ACCESS_DENIED";
}
