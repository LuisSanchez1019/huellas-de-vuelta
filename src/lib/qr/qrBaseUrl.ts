import { PUBLIC_PET_PATH } from "@/lib/pets/publicPet";

/**
 * Dominio OFICIAL del QR físico. Un QR impreso es permanente: su contenido nunca puede depender
 * del navegador desde el que se genera (`window.location.origin` podía ser localhost, un preview de
 * Vercel o un dominio de prueba). La única fuente es `NEXT_PUBLIC_SITE_URL`, y si falta o no es una
 * URL pública segura NO se genera ningún QR (falla cerrado, sin caer a otro dominio).
 *
 * Reglas: https obligatorio, dominio público (no localhost, no IP, no red privada), sin credenciales,
 * sin ruta / query / hash (solo el origen).
 */

export type QrBaseUrlErrorCode = "MISSING" | "INVALID" | "INSECURE" | "NOT_PUBLIC" | "SHAPE";

export class QrBaseUrlError extends Error {
  readonly code: QrBaseUrlErrorCode;
  constructor(code: QrBaseUrlErrorCode, message: string) {
    super(message);
    this.name = "QrBaseUrlError";
    this.code = code;
  }
}

const HELP = "Configura NEXT_PUBLIC_SITE_URL con el dominio oficial de Huellas de Vuelta (https://tu-dominio) y vuelve a desplegar.";

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) return true; // IPv6 (incluye ::1)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true; // IPv4 literal (127.*, 10.*, 192.168.*, públicas: tampoco se imprimen)
  return !host.includes("."); // sin punto: nombre de intranet
}

/** Valida y normaliza el origen del QR. Función pura (probada sin red). */
export function resolveQrBaseUrl(raw: string | undefined | null): string {
  const value = (raw ?? "").trim();
  if (!value) {
    throw new QrBaseUrlError("MISSING", `No se puede generar el QR: falta el dominio oficial. ${HELP}`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new QrBaseUrlError("INVALID", `No se puede generar el QR: NEXT_PUBLIC_SITE_URL no es una URL válida. ${HELP}`);
  }
  if (url.protocol !== "https:") {
    throw new QrBaseUrlError("INSECURE", `No se puede generar el QR: el dominio debe usar https. ${HELP}`);
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new QrBaseUrlError("SHAPE", `No se puede generar el QR: NEXT_PUBLIC_SITE_URL debe ser solo el dominio, sin ruta ni parámetros. ${HELP}`);
  }
  if (isPrivateOrLocalHost(url.hostname)) {
    throw new QrBaseUrlError("NOT_PUBLIC", `No se puede generar el QR: el dominio no es público (localhost, IP o red interna). ${HELP}`);
  }
  return url.origin;
}

/** Origen oficial configurado (lanza `QrBaseUrlError` si no es válido). */
export function getQrBaseUrl(): string {
  // Referencia literal: Next.js sustituye `process.env.NEXT_PUBLIC_*` en el bundle del navegador.
  return resolveQrBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

const PUBLIC_ID_SHAPE = /^[a-z0-9]{8,24}$/i;

/**
 * URL que codifica el QR de una placa: `<dominio oficial>/m/<public_id>`. Solo lleva el identificador
 * público del QR (no es un secreto); nunca datos de la mascota ni del propietario.
 */
export function buildQrPublicUrl(baseUrl: string, publicId: string): string {
  if (!PUBLIC_ID_SHAPE.test(publicId)) {
    throw new QrBaseUrlError("INVALID", "El identificador público del QR no es válido.");
  }
  return `${baseUrl}${PUBLIC_PET_PATH}/${publicId}`;
}

export function qrPublicUrl(publicId: string): string {
  return buildQrPublicUrl(getQrBaseUrl(), publicId);
}
