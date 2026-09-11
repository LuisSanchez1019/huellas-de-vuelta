/**
 * Señal ligera entre la página de notificaciones y la campana del panel
 * (viven en árboles de React distintos). Cuando la lista cambia —marcar como
 * leída, marcar todas, borrar— se emite este evento y la campana vuelve a
 * contar los no leídos, así el número del icono se actualiza al instante.
 */
export const NOTIFICATIONS_CHANGED_EVENT = "hdv:notifications-changed";

export function notifyNotificationsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function onNotificationsChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
}
