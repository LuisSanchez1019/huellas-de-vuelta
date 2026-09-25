import type { SupabaseClient } from "@supabase/supabase-js";
import { mapGrant, type VetGrant } from "./access";

/**
 * Servicio de IDENTIFICACIÓN. Un QR o (a futuro) NFC solo IDENTIFICAN una placa:
 * llevan un token opaco (`public_id`) que NO es un secreto ni una contraseña.
 * Nunca conceden acceso médico: eso lo decide el servidor (veterinaria aprobada +
 * grant vigente + auditoría) mediante `access.ts`/`medical.ts`.
 *
 * La placa física NO tiene código de barras, y el `short_code` (ABC-001) es un
 * identificador administrativo/interno: la veterinaria NO identifica con él (el
 * servidor tampoco lo acepta).
 *
 * No depende de la cámara: sirve igual con un lector de QR USB/Bluetooth (que
 * teclea la URL del QR y pulsa Enter), con el escáner web o con un escáner nativo
 * futuro (Capacitor).
 */

export type IdentificationMethod = "qr" | "nfc";

/** Token opaco de la URL /m/<public_id>. */
const PUBLIC_ID_RE = /^[A-Za-z0-9]{8,24}$/;
/** Formato del short_code administrativo (ABC-001, HV-L00001): NO identifica. */
const SHORT_CODE_RE = /^(?:[A-Za-z]{3}-[0-9]{3}|[Hh][Vv]-[Ll]?[0-9]{4,6})$/;

const isControlOrSpace = (code: number) => code <= 0x20 || code === 0x7f;

/**
 * Normaliza lo que llega de un lector o del teclado: quita espacios y caracteres de
 * control (Enter/CR/LF/tab, STX…) SOLO de los extremos. No altera el contenido.
 */
export function normalizeCode(raw: string): string {
  let start = 0;
  let end = raw.length;
  while (start < end && isControlOrSpace(raw.charCodeAt(start))) start++;
  while (end > start && isControlOrSpace(raw.charCodeAt(end - 1))) end--;
  return raw.slice(start, end);
}

/** ¿Tiene forma de token de placa (public_id)? El short_code no la tiene (lleva guion). */
export function isPlausiblePublicId(code: string): boolean {
  return PUBLIC_ID_RE.test(code);
}

/** ¿Es un short_code administrativo? Se rechaza con un mensaje propio. */
export function isShortCode(code: string): boolean {
  return SHORT_CODE_RE.test(code);
}

export interface ScanResolution {
  code: string;
  method: IdentificationMethod;
}

/**
 * Interpreta el texto leído por el escáner o el lector. El QR de una placa contiene la
 * URL `/m/<public_id>` (solo se extrae ese token; jamás se navega ahí). También se
 * acepta el token suelto (lo que escribiría un lector NFC/QR configurado sin URL).
 * Devuelve `null` si no es un identificador válido: incluye el short_code.
 */
export function parseScanPayload(text: string): ScanResolution | null {
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
  if (!isPlausiblePublicId(raw)) return null;
  return { code: raw, method: "qr" };
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
  invalid_code: "Lee el QR de la placa: este código no es un identificador válido.",
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
