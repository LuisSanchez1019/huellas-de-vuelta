/**
 * Versión vigente de la Política de información y uso de marca de aliados.
 *
 * DEBE coincidir con `public._current_ally_brand_policy_version()` en
 * Supabase: el servidor guarda esta misma cadena en cada fila de
 * `organization_authorizations` al otorgar/revocar una autorización. Al
 * publicar una nueva versión: sube este valor, actualiza la migración de
 * `_current_ally_brand_policy_version()` y despliega ambos juntos.
 */
export const ALLY_BRAND_POLICY_VERSION = "1.0";

/** Fecha de la última actualización (para mostrar en la política). */
export const ALLY_BRAND_POLICY_LAST_UPDATED = "15 de septiembre de 2026";

/** Ruta pública de la política completa. */
export const ALLY_BRAND_POLICY_PATH = "/legal/marca-aliados";
