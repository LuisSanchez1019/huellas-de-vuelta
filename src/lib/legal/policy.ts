/**
 * Versión vigente de la Política de Tratamiento de Datos Personales.
 *
 * DEBE coincidir con `public._current_data_policy_version()` en Supabase: el
 * servidor valida esta misma cadena al crear la cuenta (metadato
 * `policy_consent_version`) y al registrar el re-consentimiento.
 *
 * Al publicar una nueva versión: sube este valor, actualiza la migración de
 * `_current_data_policy_version()` y despliega ambos juntos. Los usuarios verán
 * el aviso de re-consentimiento en su siguiente ingreso.
 */
export const DATA_POLICY_VERSION = "1.0";

/** Fecha de la última actualización (para mostrar en la política). */
export const DATA_POLICY_LAST_UPDATED = "11 de septiembre de 2026";

/** Identificador del tipo de política/consentimiento. */
export const DATA_POLICY_TYPE = "data_processing" as const;

/** Ruta pública de la política completa. */
export const DATA_POLICY_PATH = "/legal/tratamiento-de-datos";
