// Huellas de Vuelta: tipos y etiquetas del flujo de REENCUENTRO.
// Un aviso (pet_report_events) es un avistamiento o un aviso de encuentro ligado
// al reporte de perdida activo de una mascota. Nunca crea otra mascota ni otro reporte.

export type ReportEventType = "sighting" | "found" | "found_needs_help";

export const eventTypeLabels: Record<ReportEventType, string> = {
  sighting: "La vi",
  found: "La tengo conmigo",
  found_needs_help: "Necesita ayuda",
};

/** Id del icono que representa cada situación (se mapea a un componente en el wizard). */
export type EventChoiceIcon = "eye" | "hand" | "cross";

/** Opciones del primer paso del asistente, en el orden que se muestran. */
export const eventTypeChoices: {
  value: ReportEventType;
  icon: EventChoiceIcon;
  title: string;
  hint: string;
}[] = [
  {
    value: "sighting",
    icon: "eye",
    title: "La vi",
    hint: "La vi, pero ya no está conmigo.",
  },
  {
    value: "found",
    icon: "hand",
    title: "La tengo conmigo",
    hint: "La encontré y actualmente está conmigo.",
  },
  {
    value: "found_needs_help",
    icon: "cross",
    title: "Necesita ayuda",
    hint: "La tengo conmigo y necesita atención.",
  },
];

export type PetCondition = "ok" | "scared" | "injured" | "needs_attention";

export const petConditionLabels: Record<PetCondition, string> = {
  ok: "Está bien",
  scared: "Parece asustada",
  injured: "Parece herida",
  needs_attention: "Necesita atención",
};

export const petConditionOptions = Object.entries(petConditionLabels) as [PetCondition, string][];

export type OrgCategory = "veterinaria" | "fundacion" | "refugio" | "otro_aliado";

export const orgCategoryLabels: Record<OrgCategory, string> = {
  veterinaria: "Veterinaria",
  fundacion: "Fundación",
  refugio: "Refugio",
  otro_aliado: "Aliado",
};

export type OrgApprovalStatus = "pending" | "approved" | "rejected";

export const orgApprovalLabels: Record<OrgApprovalStatus, string> = {
  pending: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export type ReportStage = "reported" | "sighted" | "in_contact" | "in_organization";

export const reportStageLabels: Record<ReportStage, string> = {
  reported: "Reportada",
  sighted: "Con avistamientos",
  in_contact: "Alguien la tiene",
  in_organization: "Camino a una organización",
};

export const DESCRIPTION_MAX = 400;
export const FINDER_CONTACT_MAX = 120;
export const FINDER_NAME_MAX = 80;

/** Fila de `pet_report_events` tal como la lee el propietario (incluye contacto privado). */
export interface ReportEvent {
  id: string;
  report_id: string;
  pet_id: string;
  owner_id: string;
  type: ReportEventType;
  city: string;
  neighborhood: string;
  happened_on: string | null;
  happened_at_approx: string | null;
  description: string | null;
  pet_condition: PetCondition | null;
  finder_name: string | null;
  finder_contact: string | null;
  selected_org_id: string | null;
  selected_org_at: string | null;
  org_received_at: string | null;
  org_received_note: string | null;
  org_declined_at: string | null;
  photo_path: string | null;
  acknowledged_at: string | null;
  created_at: string;
  /** Mascota anidada, para las listas del panel. */
  pet?: {
    name: string;
    species: string;
    species_other: string | null;
    breed: string | null;
    photo_path: string | null;
  } | null;
  /** Organización elegida, anidada (solo datos públicos). */
  selected_org?: { name: string; category: string; city: string | null } | null;
}

/** Estado derivado de un aviso "necesita ayuda" respecto a la organización elegida. */
export type OrgDeliveryStatus = "none" | "pending" | "received" | "declined";

export function orgDeliveryStatus(event: Pick<ReportEvent, "selected_org_id" | "org_received_at" | "org_declined_at">): OrgDeliveryStatus {
  if (!event.selected_org_id) return "none";
  if (event.org_received_at) return "received";
  if (event.org_declined_at) return "declined";
  return "pending";
}

export const orgDeliveryStatusLabels: Record<OrgDeliveryStatus, string> = {
  none: "",
  pending: "Pendiente de entrega",
  received: "Recibida",
  declined: "No recibida",
};

/**
 * Fila de `list_org_delivery_events()` (vista de la ORGANIZACIÓN): columnas
 * seguras solamente, sin `finder_name`/`finder_contact` — la organización
 * solo debe ver "usuario anónimo" como reportante.
 */
export interface OrgDeliveryEvent {
  id: string;
  reportId: string;
  petId: string;
  type: ReportEventType;
  city: string;
  neighborhood: string;
  petCondition: PetCondition | null;
  description: string | null;
  selectedOrgAt: string | null;
  orgReceivedAt: string | null;
  orgDeclinedAt: string | null;
  pet: {
    name: string;
    species: string;
    species_other: string | null;
    breed: string | null;
    photo_path: string | null;
  };
}

export function orgDeliveryEventStatus(
  event: Pick<OrgDeliveryEvent, "orgReceivedAt" | "orgDeclinedAt">,
): Exclude<OrgDeliveryStatus, "none"> {
  if (event.orgReceivedAt) return "received";
  if (event.orgDeclinedAt) return "declined";
  return "pending";
}

/** Organización aprobada devuelta por `list_help_organizations`. */
export interface HelpOrganization {
  id: string;
  name: string;
  category: OrgCategory;
  kind: string;
  description: string | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  hours: unknown;
  mapUrl: string | null;
  lat: number | null;
  lng: number | null;
}

/** Datos que envía el asistente al RPC `submit_report_event`. */
export interface SubmitReportEventInput {
  publicId: string;
  type: ReportEventType;
  city: string;
  neighborhood: string;
  happenedOn: string | null;
  happenedAtApprox: string | null;
  description: string | null;
  petCondition: PetCondition | null;
  finderName: string | null;
  finderContact: string | null;
  selectedOrgId: string | null;
  photoPath: string | null;
}
