/** Utilidades compartidas para números de teléfono/WhatsApp. */

/** Deja solo los dígitos (espacios, guiones y paréntesis se ignoran). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Mínimo 10 dígitos válidos, igual en frontend y backend (ver CHECK en BD). */
export function isValidPhone(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length >= 10;
}

/**
 * Enlace `wa.me` a partir de un número (con o sin formato visual). `null` si
 * no alcanza los 10 dígitos mínimos, para que el llamador simplemente no
 * muestre el botón de WhatsApp.
 */
export function whatsappLink(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = digitsOnly(value);
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}
