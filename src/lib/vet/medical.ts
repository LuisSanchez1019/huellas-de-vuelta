import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdentificationMethod } from "./identification";

/**
 * Servicio MÉDICO. Todo exige un grant vigente con el permiso específico, que la
 * BD comprueba en CADA llamada (nada de tokens locales). Los datos médicos solo
 * viven en memoria del componente: nunca en URL, localStorage, sessionStorage,
 * logs ni analytics.
 */

export const URGENCY_LABELS = { routine: "Rutina", urgent: "Urgente", emergency: "Emergencia" } as const;
export type Urgency = keyof typeof URGENCY_LABELS;

export const ROUTE_LABELS = {
  oral: "Oral",
  topical: "Tópica",
  intravenous: "Intravenosa",
  intramuscular: "Intramuscular",
  subcutaneous: "Subcutánea",
  ophthalmic: "Oftálmica",
  otic: "Ótica",
  inhaled: "Inhalada",
  rectal: "Rectal",
  other: "Otra",
} as const;
export type MedRoute = keyof typeof ROUTE_LABELS;

export interface Medication {
  name: string;
  dose: number | null;
  doseUnit: string | null;
  frequency: string | null;
  route: MedRoute | null;
  durationDays: number | null;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
}

export interface Addendum {
  id: string;
  createdAt: string;
  body: string;
  orgName: string | null;
  vetName: string | null;
}

export interface Consultation {
  id: string;
  consultedAt: string;
  orgName: string | null;
  vetName: string | null;
  /** ¿La escribió la organización que consulta? (solo esa puede añadir addenda). */
  ownOrg: boolean;
  reason: string;
  weightKg: number | null;
  temperatureC: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  symptoms: string | null;
  physicalExam: string | null;
  diagnosis: string | null;
  treatment: string | null;
  recommendations: string | null;
  finalObservations: string | null;
  urgency: Urgency;
  followUpDate: string | null;
  medications: Medication[];
  addenda: Addendum[];
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export function mapConsultation(raw: Record<string, unknown>): Consultation {
  return {
    id: String(raw.id),
    consultedAt: String(raw.consulted_at),
    orgName: str(raw.org_name),
    vetName: str(raw.vet_name),
    ownOrg: Boolean(raw.own_org),
    reason: String(raw.reason),
    weightKg: num(raw.weight_kg),
    temperatureC: num(raw.temperature_c),
    heartRate: num(raw.heart_rate),
    respiratoryRate: num(raw.respiratory_rate),
    symptoms: str(raw.symptoms),
    physicalExam: str(raw.physical_exam),
    diagnosis: str(raw.diagnosis),
    treatment: str(raw.treatment),
    recommendations: str(raw.recommendations),
    finalObservations: str(raw.final_observations),
    urgency: raw.urgency as Urgency,
    followUpDate: str(raw.follow_up_date),
    medications: ((raw.medications as Record<string, unknown>[]) ?? []).map((m) => ({
      name: String(m.name),
      dose: num(m.dose),
      doseUnit: str(m.dose_unit),
      frequency: str(m.frequency),
      route: (m.route as MedRoute | null) ?? null,
      durationDays: num(m.duration_days),
      instructions: str(m.instructions),
      startDate: str(m.start_date),
      endDate: str(m.end_date),
      notes: str(m.notes),
    })),
    addenda: ((raw.addenda as Record<string, unknown>[]) ?? []).map((a) => ({
      id: String(a.id),
      createdAt: String(a.created_at),
      body: String(a.body),
      orgName: str(a.org_name),
      vetName: str(a.vet_name),
    })),
  };
}

export interface HistoryPage {
  items: Consultation[];
  hasMore: boolean;
  nextBefore: string | null;
}

export function mapHistoryPage(data: unknown): HistoryPage {
  const raw = data as { items: Record<string, unknown>[]; has_more: boolean; next_before: string | null };
  return { items: (raw.items ?? []).map(mapConsultation), hasMore: Boolean(raw.has_more), nextBefore: raw.next_before ?? null };
}

export interface MedicalOverview {
  pet: {
    name: string;
    species: string;
    speciesOther: string | null;
    breed: string | null;
    sex: string | null;
    ageValue: number | null;
    ageUnit: string | null;
  };
  summary: { hasCondition: boolean; hasAllergy: boolean; hasMedication: boolean; hasUrgent: boolean; notes: string | null } | null;
  declaredItems: { kind: string; label: string; detail: string | null }[];
  consultationCount: number;
  plateCode: string | null;
  permissions: string[];
  expiresAt: string;
}

export async function fetchOverview(supabase: SupabaseClient, grantId: string): Promise<MedicalOverview> {
  const { data, error } = await supabase.rpc("vet_medical_overview", { p_grant_id: grantId });
  if (error) throw error;
  const raw = data as unknown as Record<string, unknown>;
  const pet = raw.pet as Record<string, unknown>;
  const summary = raw.summary as Record<string, unknown> | null;
  return {
    pet: {
      name: String(pet.name),
      species: String(pet.species),
      speciesOther: str(pet.species_other),
      breed: str(pet.breed),
      sex: str(pet.sex),
      ageValue: num(pet.age_value),
      ageUnit: str(pet.age_unit),
    },
    summary: summary
      ? {
          hasCondition: Boolean(summary.has_condition),
          hasAllergy: Boolean(summary.has_allergy),
          hasMedication: Boolean(summary.has_medication),
          hasUrgent: Boolean(summary.has_urgent),
          notes: str(summary.notes),
        }
      : null,
    declaredItems: ((raw.items as Record<string, unknown>[]) ?? []).map((i) => ({
      kind: String(i.kind),
      label: String(i.label),
      detail: str(i.detail),
    })),
    consultationCount: Number(raw.consultation_count ?? 0),
    plateCode: str(raw.plate_code),
    permissions: (raw.permissions as string[]) ?? [],
    expiresAt: String(raw.expires_at),
  };
}

/** Una página de la historia (paginada; nunca se descarga todo de golpe). */
export async function fetchHistoryPage(
  supabase: SupabaseClient,
  grantId: string,
  options: { limit?: number; before?: string | null } = {},
): Promise<HistoryPage> {
  const { data, error } = await supabase.rpc("vet_medical_history", {
    p_grant_id: grantId,
    p_limit: options.limit ?? 10,
    p_before: options.before ?? undefined,
  });
  if (error) throw error;
  return mapHistoryPage(data);
}

export interface MedicationInput {
  name: string;
  dose?: string;
  dose_unit?: string;
  frequency?: string;
  route?: string;
  duration_days?: string;
  instructions?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
}

export interface ConsultationInput {
  reason: string;
  weightKg?: number | null;
  temperatureC?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  symptoms?: string;
  physicalExam?: string;
  diagnosis?: string;
  treatment?: string;
  recommendations?: string;
  finalObservations?: string;
  urgency: Urgency;
  followUpDate?: string | null;
  medications: MedicationInput[];
}

/**
 * Registra una consulta (append-only). `clientRequestId` es estable por
 * formulario: un doble clic o un reintento de red devuelven la MISMA consulta
 * (`duplicate: true`) en vez de crear otra.
 */
export async function createConsultation(
  supabase: SupabaseClient,
  grantId: string,
  clientRequestId: string,
  input: ConsultationInput,
): Promise<{ id: string; duplicate: boolean }> {
  const blank = (v: string | undefined) => (v && v.trim() ? v : undefined);
  const { data, error } = await supabase.rpc("vet_consultation_create", {
    p_grant_id: grantId,
    p_client_request_id: clientRequestId,
    p_reason: input.reason,
    p_weight_kg: input.weightKg ?? undefined,
    p_temperature_c: input.temperatureC ?? undefined,
    p_heart_rate: input.heartRate ?? undefined,
    p_respiratory_rate: input.respiratoryRate ?? undefined,
    p_symptoms: blank(input.symptoms),
    p_physical_exam: blank(input.physicalExam),
    p_diagnosis: blank(input.diagnosis),
    p_treatment: blank(input.treatment),
    p_recommendations: blank(input.recommendations),
    p_final_observations: blank(input.finalObservations),
    p_urgency: input.urgency,
    p_follow_up_date: blank(input.followUpDate ?? undefined),
    p_medications: input.medications.filter((m) => m.name.trim()),
  });
  if (error) throw error;
  const row = data as unknown as { id: string; duplicate: boolean };
  return { id: row.id, duplicate: row.duplicate };
}

export async function addAddendum(
  supabase: SupabaseClient,
  grantId: string,
  clientRequestId: string,
  consultationId: string,
  body: string,
): Promise<{ id: string; duplicate: boolean }> {
  const { data, error } = await supabase.rpc("vet_consultation_add_addendum", {
    p_grant_id: grantId,
    p_client_request_id: clientRequestId,
    p_consultation_id: consultationId,
    p_body: body,
  });
  if (error) throw error;
  const row = data as unknown as { id: string; duplicate: boolean };
  return { id: row.id, duplicate: row.duplicate };
}

export interface EmergencyInfo {
  pet: { name: string; species: string; breed: string | null };
  items: { kind: string; label: string; detail: string | null }[];
}

/** Nivel 2 (emergencia): SOLO lo que el propietario marcó como visible en emergencias. Sin grant. */
export async function emergencyAccess(
  supabase: SupabaseClient,
  tagPublicId: string,
  reason: string,
  method: IdentificationMethod,
): Promise<EmergencyInfo> {
  const { data, error } = await supabase.rpc("vet_emergency_access", {
    p_tag_public_id: tagPublicId,
    p_reason: reason,
    p_method: method,
  });
  if (error) throw error;
  const raw = data as unknown as { pet: Record<string, unknown>; items: Record<string, unknown>[] };
  return {
    pet: { name: String(raw.pet.name), species: String(raw.pet.species), breed: str(raw.pet.breed) },
    items: (raw.items ?? []).map((i) => ({ kind: String(i.kind), label: String(i.label), detail: str(i.detail) })),
  };
}

export interface PdfAuthorization {
  petName: string;
  plateCode: string | null;
  orgName: string | null;
  vetName: string | null;
  ownerName: string | null;
  generatedAt: string;
}

/** Autoriza (y audita) la generación del PDF. Sin esto no se arma ningún documento. */
export async function authorizePdf(supabase: SupabaseClient, grantId: string): Promise<PdfAuthorization> {
  const { data, error } = await supabase.rpc("vet_pdf_authorize", { p_grant_id: grantId });
  if (error) throw error;
  const raw = data as unknown as Record<string, unknown>;
  return {
    petName: String(raw.pet_name),
    plateCode: str(raw.plate_code),
    orgName: str(raw.org_name),
    vetName: str(raw.vet_name),
    ownerName: null,
    generatedAt: String(raw.generated_at),
  };
}

/** Trae TODAS las páginas (máx. `cap` consultas) para armar el PDF, ya autorizado. */
export async function fetchAllForPdf(
  fetchPage: (before: string | null) => Promise<HistoryPage>,
  cap = 200,
): Promise<Consultation[]> {
  const all: Consultation[] = [];
  let before: string | null = null;
  while (all.length < cap) {
    const page: HistoryPage = await fetchPage(before);
    all.push(...page.items);
    if (!page.hasMore || !page.nextBefore) break;
    before = page.nextBefore;
  }
  return all;
}
