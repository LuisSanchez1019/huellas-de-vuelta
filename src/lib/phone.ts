/** Utilidades compartidas para números de teléfono/WhatsApp. */

/** Deja solo los dígitos (espacios, guiones, paréntesis y el `+` se ignoran). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Mínimo 10 dígitos válidos, igual en frontend y backend (ver CHECK en BD). */
export function isValidPhone(value: string): boolean {
  return digitsOnly(value).length >= 10;
}

/**
 * Normaliza un número a formato internacional para `wa.me` (sin `+`).
 *
 * - Si ya trae indicativo de país (Colombia `57` + 10 dígitos, o >= 11 dígitos
 *   en general), se usa tal cual.
 * - Un móvil colombiano "pelado" (10 dígitos que empiezan por 3) se completa a
 *   `57XXXXXXXXXX`, que es como WhatsApp espera el número en Colombia.
 * - `null` si no alcanza los 10 dígitos mínimos.
 */
export function normalizeWhatsappNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = digitsOnly(value);
  if (digits.length < 10) return null;
  if (/^57\d{10}$/.test(digits)) return digits;           // ya internacional (CO)
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;       // móvil CO sin indicativo
  return digits;                                           // otro país / ya con indicativo
}

/**
 * Enlace `https://wa.me/<número internacional>` a partir de un número con o sin
 * formato visual. `null` si el número no es válido, para que el llamador
 * simplemente no muestre el botón de WhatsApp.
 */
export function whatsappLink(value: string | null | undefined): string | null {
  const normalized = normalizeWhatsappNumber(value);
  return normalized ? `https://wa.me/${normalized}` : null;
}
