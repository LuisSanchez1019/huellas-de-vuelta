import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  HelpOrganization,
  OrgCategory,
  OrgDeliveryEvent,
  PetCondition,
  ReportEvent,
  ReportEventType,
  SubmitReportEventInput,
} from "@/lib/pets/reencuentro";
import type { PetReportStatus } from "@/lib/pets/reports";
import type { PetSpecies } from "./types";

const EVENTS_TABLE = "pet_report_events";

/** Bucket privado para la foto opcional del hallazgo (subida anónima restringida). */
export const REPORT_EVIDENCE_BUCKET = "report-evidence";

/**
 * Sube la foto del hallazgo a `report-evidence/reports/<reportId>/<uuid>.<ext>`.
 * La política de Storage solo acepta esta ruta y solo si el reporte está activo.
 * Devuelve la ruta del objeto (no una URL).
 */
export async function uploadReportEvidence(
  supabase: SupabaseClient,
  reportId: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  const path = `reports/${reportId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(REPORT_EVIDENCE_BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** URL firmada temporal para que el propietario vea la foto de un aviso. `null` si falla. */
export async function getReportEvidenceSignedUrl(
  supabase: SupabaseClient,
  photoPath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(REPORT_EVIDENCE_BUCKET)
      .createSignedUrl(photoPath, expiresInSeconds);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Registra un avistamiento o aviso de encuentro para el reporte activo de una
 * mascota. Funciona sin cuenta (RPC `security definer`). Devuelve el id del evento.
 */
export async function submitReportEvent(
  supabase: SupabaseClient,
  input: SubmitReportEventInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("submit_report_event", {
    p_public_id: input.publicId,
    p_type: input.type,
    p_city: input.city,
    p_neighborhood: input.neighborhood,
    p_happened_on: input.happenedOn,
    p_happened_at_approx: input.happenedAtApprox,
    p_description: input.description,
    p_pet_condition: input.petCondition,
    p_finder_name: input.finderName,
    p_finder_contact: input.finderContact,
    p_selected_org_id: input.selectedOrgId,
    p_photo_path: input.photoPath,
  });
  if (error) throw error;
  return String(data);
}

const EVENT_SELECT =
  "*, pet:pets(name, species, species_other, breed, photo_path), selected_org:organization_profiles(name, category, city)";

/** Avisos de un reporte concreto (solo el propietario, por RLS). */
export async function fetchReportEvents(
  supabase: SupabaseClient,
  reportId: string,
): Promise<ReportEvent[]> {
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select(EVENT_SELECT)
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReportEvent[];
}

/** Todos los avisos de los reportes del usuario cuyo reporte está en `status`. */
export async function fetchEventsForMyReports(
  supabase: SupabaseClient,
  status: PetReportStatus,
): Promise<ReportEvent[]> {
  const { data: reports, error: reportsError } = await supabase
    .from("pet_reports")
    .select("id")
    .eq("status", status);
  if (reportsError) throw reportsError;
  const ids = (reports ?? []).map((row) => row.id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select(EVENT_SELECT)
    .in("report_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReportEvent[];
}

/**
 * Avisos "necesita ayuda" que seleccionaron a MI organización, vía RPC
 * `security definer` (no una política RLS de fila completa): la función
 * solo devuelve columnas seguras, deliberadamente SIN `finder_name` ni
 * `finder_contact` — esos datos son privados entre quien reporta y el
 * propietario, la organización solo debe ver "usuario anónimo". Base de
 * "Recepción de mascotas".
 */
export async function fetchOrgDeliveryEvents(supabase: SupabaseClient): Promise<OrgDeliveryEvent[]> {
  const { data, error } = await supabase.rpc("list_org_delivery_events");
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    reportId: String(row.report_id),
    petId: String(row.pet_id),
    type: row.type as ReportEventType,
    city: String(row.city ?? ""),
    neighborhood: String(row.neighborhood ?? ""),
    petCondition: (row.pet_condition as PetCondition) ?? null,
    description: (row.description as string) ?? null,
    selectedOrgAt: (row.selected_org_at as string) ?? null,
    orgReceivedAt: (row.org_received_at as string) ?? null,
    orgDeclinedAt: (row.org_declined_at as string) ?? null,
    pet: {
      name: String(row.pet_name ?? ""),
      species: String(row.pet_species ?? "") as PetSpecies,
      species_other: (row.pet_species_other as string) ?? null,
      breed: (row.pet_breed as string) ?? null,
      photo_path: (row.pet_photo_path as string) ?? null,
    },
  }));
}

export interface OrgPetOwnerContact {
  authorized: boolean;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerPhoneAlt: string | null;
  ownerEmail: string | null;
}

/**
 * Datos de contacto del propietario de la mascota que YA recibió esta
 * organización. El backend (RPC `security definer`) valida que quien llama es la
 * organización seleccionada, que confirmó la recepción y que el propietario
 * activó la autorización `allow_org_contact_access`. Si no la activó, devuelve
 * `authorized: false` sin ningún dato.
 */
export async function fetchOrgPetOwnerContact(
  supabase: SupabaseClient,
  eventId: string,
): Promise<OrgPetOwnerContact> {
  const { data, error } = await supabase.rpc("org_pet_owner_contact", { p_event_id: eventId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return {
    authorized: Boolean(row?.authorized),
    ownerName: (row?.owner_name as string) ?? null,
    ownerPhone: (row?.owner_phone as string) ?? null,
    ownerPhoneAlt: (row?.owner_phone_alt as string) ?? null,
    ownerEmail: (row?.owner_email as string) ?? null,
  };
}

/**
 * La organización confirma o declina la recepción de la mascota (RPC
 * `security definer`: valida server-side que quien llama es dueño de la
 * organización seleccionada en ese aviso).
 */
export async function orgConfirmPetReceipt(
  supabase: SupabaseClient,
  eventId: string,
  received: boolean,
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc("org_confirm_pet_receipt", {
    p_event_id: eventId,
    p_received: received,
    p_note: note?.trim() || null,
  });
  if (error) throw error;
}

/**
 * Avisos donde una organización YA confirmó que recibió a la mascota (para
 * "Mi actividad" → "En veterinarias/fundaciones"). RLS ya limita esto a los
 * avisos del usuario autenticado.
 */
export async function fetchReceivedPetEvents(supabase: SupabaseClient): Promise<ReportEvent[]> {
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select(EVENT_SELECT)
    .not("org_received_at", "is", null)
    .order("org_received_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReportEvent[];
}

/** Marca un aviso como visto por el propietario. */
export async function acknowledgeReportEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<void> {
  const { error } = await supabase
    .from(EVENTS_TABLE)
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw error;
}

/** Organizaciones aprobadas para "busca ayuda cerca de ti" (RPC público). */
export async function listHelpOrganizations(
  supabase: SupabaseClient,
  city: string | null,
): Promise<HelpOrganization[]> {
  const { data, error } = await supabase.rpc("list_help_organizations", {
    p_city: city && city.trim() ? city.trim() : null,
  });
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    category: (row.category as OrgCategory) ?? "otro_aliado",
    kind: String(row.kind ?? ""),
    description: (row.description as string) ?? null,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    neighborhood: (row.neighborhood as string) ?? null,
    phone: (row.phone as string) ?? null,
    whatsapp: (row.whatsapp as string) ?? null,
    hours: row.hours ?? [],
    mapUrl: (row.map_url as string) ?? null,
    lat: (row.lat as number) ?? null,
    lng: (row.lng as number) ?? null,
  }));
}
