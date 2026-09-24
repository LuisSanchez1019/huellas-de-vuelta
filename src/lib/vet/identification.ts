import type { SupabaseClient } from "@supabase/supabase-js";
import { mapGrant, type VetGrant } from "./access";

/**
 * Servicio de IDENTIFICACIÓN. Un QR, un código de barras, un short_code escrito
 * o (a futuro) NFC solo IDENTIFICAN una placa. Nunca conceden acceso médico:
 * eso lo decide `access.ts`/`medical.ts` con un grant vigente.
 *
 * No depende de la cámara: sirve igual con un lector HID (que teclea el código
 * y pulsa Enter), con el escáner web o con un escáner nativo futuro (Capacitor).
 */

export type IdentificationMethod = "qr" | "barcode" | "manual" | "nfc";

/** Mismos formatos que el CHECK de qr_tags.short_code. */
const SHORT_CODE_RE = /^(?:[A-Za-z]{3}-[0-9]{3}|[Hh][Vv]-[Ll]?[0-9]{4,6})$/;
/** Token opaco de la URL /m/<public_id>. */
const PUBLIC_ID_RE = /^[A-Za-z0-9]{8,24}$/;

const isControlOrSpace = (code: number) => code <= 0x20 || code === 0x7f;

/**
 * Normaliza lo que llega del teclado o de un lector HID: quita espacios y
 * caracteres de control (Enter/CR/LF/tab) de los extremos y, si tiene forma de
 * short_code, lo pasa a mayúsculas. No altera el contenido del identificador.
 */
export function normalizeCode(raw: string): string {
  // El lector HID puede anteponer/añadir caracteres de control (Enter, STX...): se quitan solo de los extremos.
  let start = 0;
  let end = raw.length;
  while (start < end && isControlOrSpace(raw.charCodeAt(start))) start++;
  while (end > start && isControlOrSpace(raw.charCodeAt(end - 1))) end--;
  const trimmed = raw.slice(start, end);
  return SHORT_CODE_RE.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}

export function isPlausibleCode(code: string): boolean {
  return SHORT_CODE_RE.test(code) || PUBLIC_ID_RE.test(code);
}

export interface ScanResolution {
  code: string;
  method: IdentificationMethod;
}

/**
 * Interpreta el texto leído por el escáner. El QR de una placa contiene la URL
 * `/m/<public_id>` (solo se extrae ese token; jamás se navega ahí). Un código de
 * barras contiene el short_code. Devuelve `null` si no es un identificador
 * válido (código inválido).
 */
export function parseScanPayload(text: string, format: "qr" | "barcode"): ScanResolution | null {
  const raw = normalizeCode(text);
  if (raw === "" || raw.length > 300) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const match = /^\/m\/([A-Za-z0-9]{8,24})\/?$/.exec(new URL(raw).pathname);
      return match ? { code: match[1], method: "qr" } : null;
    } catch {
      return null;
    }
  }
  if (!isPlausibleCode(raw)) return null;
  return { code: raw, method: format === "barcode" ? "barcode" : "qr" };
}

export interface IdentifiedPet {
  name: string;
  species: string;
  speciesOther: string | null;
  breed: string | null;
  status: string;
  /** Solo si la foto es pública (misma regla del perfil público). */
  photoPath: string | null;
  medicalAlert: boolean;
}

export type IdentifyFailure = "not_found" | "invalid_code" | "not_active" | "suspended" | "replaced" | "annulled";

export type IdentifyResult =
  | {
      outcome: "found";
      /** Token opaco de la placa; se usa para solicitar acceso / emergencia (nunca un id de mascota). */
      tagPublicId: string;
      plateCode: string;
      pet: IdentifiedPet;
      hasEmergencyInfo: boolean;
      /** Grant vigente o pendiente del PROPIO profesional (nunca de otras organizaciones). */
      grant: VetGrant | null;
    }
  | { outcome: IdentifyFailure };

export const IDENTIFY_FAILURE_MESSAGES: Record<IdentifyFailure, string> = {
  not_found: "No encontramos este identificador.",
  invalid_code: "El código no tiene un formato válido.",
  not_active: "Este identificador todavía no está activo.",
  suspended: "Este identificador está temporalmente suspendido.",
  replaced: "Este identificador ya no está activo: fue reemplazado por otro.",
  annulled: "Este identificador fue anulado. Acceso denegado.",
};

export async function identifyPet(
  supabase: SupabaseClient,
  code: string,
  method: IdentificationMethod,
): Promise<IdentifyResult> {
  const { data, error } = await supabase.rpc("vet_identify_pet", {
    p_code: normalizeCode(code),
    p_method: method,
  });
  if (error) throw error;
  const row = data as unknown as Record<string, unknown>;
  if (row.outcome !== "found") {
    return { outcome: row.outcome as IdentifyFailure };
  }
  const pet = row.pet as Record<string, unknown>;
  return {
    outcome: "found",
    tagPublicId: String(row.tag_public_id),
    plateCode: String(row.plate_code),
    pet: {
      name: String(pet.name),
      species: String(pet.species),
      speciesOther: (pet.species_other as string | null) ?? null,
      breed: (pet.breed as string | null) ?? null,
      status: String(pet.status),
      photoPath: (pet.photo_path as string | null) ?? null,
      medicalAlert: Boolean(pet.medical_alert),
    },
    hasEmergencyInfo: Boolean(row.has_emergency_info),
    grant: row.grant ? mapGrant(row.grant as Record<string, unknown>) : null,
  };
}
