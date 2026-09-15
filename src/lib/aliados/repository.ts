import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserId } from "@/lib/auth/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PUBLIC_ALLIES_TAG, triggerPublicRevalidate } from "@/lib/cache/tags";
import {
  fetchOrgProfileRow,
  upsertOrgProfileRow,
  type OrgProfileRow,
  type OrgProfileWrite,
} from "@/lib/supabase/orgProfiles";
import type {
  AliadoProfile,
  AliadoProfileInput,
  ApprovalStatus,
  OrgAuthorization,
  OrgAuthorizationType,
} from "./types";

/**
 * Acceso al perfil de la cuenta aliada (Supabase con sesión real; localStorage
 * como respaldo en modo desarrollo sin sesión, igual que veterinaria/fundación).
 */
export interface AliadoRepository {
  getMine(ownerId: string): Promise<AliadoProfile | null>;
  saveMine(ownerId: string, input: AliadoProfileInput): Promise<AliadoProfile>;
}

const KEY_PREFIX = "hdv.aliadoProfile.";

function toWrite(input: AliadoProfileInput): OrgProfileWrite {
  return {
    name: input.name,
    category: "otro_aliado",
    logoUrl: input.logoUrl,
    logoPath: input.logoPath,
    coverImageUrl: "",
    description: input.description,
    phone: input.phone,
    whatsapp: input.whatsapp,
    email: input.email,
    hours: [],
    social: input.website ? { website: input.website } : {},
    address: input.address,
    city: input.city,
    neighborhood: "",
    mapUrl: input.mapUrl,
    lat: null,
    lng: null,
    extraInfo: "",
    // El directorio público de aliados exige, además, autorización de
    // publicación (`organization_authorizations`): quedar "published" aquí no
    // hace pública la empresa por sí solo.
    status: "published",
    country: input.country,
    legalName: input.legalName,
    mobilePhone: input.mobilePhone,
    sectorId: input.sectorId,
  };
}

function rowToProfile(row: OrgProfileRow): AliadoProfile {
  const social = (row.social ?? {}) as Record<string, string>;
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    legalName: row.legal_name ?? "",
    description: row.description ?? "",
    logoUrl: row.logo_url ?? "",
    logoPath: row.logo_path ?? "",
    sectorId: row.sector_id ?? null,
    country: row.country ?? "",
    city: row.city ?? "",
    address: row.address ?? "",
    mapUrl: row.map_url ?? "",
    website: social.website ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    mobilePhone: row.mobile_phone ?? "",
    whatsapp: row.whatsapp ?? "",
    status: row.status === "published" ? "published" : "draft",
    approvalStatus: (row.approval_status === "approved" || row.approval_status === "rejected"
      ? row.approval_status
      : "pending") as ApprovalStatus,
    isActive: row.is_active !== false,
    rejectionReason: row.rejection_reason ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------- implementación local (localStorage), solo para modo desarrollo sin sesión ----------

function read(ownerId: string): AliadoProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${ownerId}`);
    return raw ? (JSON.parse(raw) as AliadoProfile) : null;
  } catch {
    return null;
  }
}

function write(ownerId: string, profile: AliadoProfile): void {
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${ownerId}`, JSON.stringify(profile));
  } catch {
    /* almacenamiento no disponible */
  }
}

const local: AliadoRepository = {
  async getMine(ownerId) {
    return read(ownerId);
  },
  async saveMine(ownerId, input) {
    const existing = read(ownerId);
    const now = new Date().toISOString();
    const profile: AliadoProfile = {
      id: existing?.id ?? `aliado_${ownerId}`,
      ownerId,
      slug: existing?.slug ?? "aliado",
      status: "published",
      approvalStatus: existing?.approvalStatus ?? "approved",
      isActive: existing?.isActive ?? true,
      rejectionReason: existing?.rejectionReason ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...input,
    };
    write(ownerId, profile);
    return profile;
  },
};

// ---------- adaptador: Supabase con sesión real, localStorage sin ella ----------

export const aliadoRepository: AliadoRepository = {
  async getMine(ownerId) {
    if (!(await getSupabaseUserId())) return local.getMine(ownerId);
    const row = await fetchOrgProfileRow("aliado", ownerId);
    return row ? rowToProfile(row) : null;
  },
  async saveMine(ownerId, input) {
    if (!(await getSupabaseUserId())) return local.saveMine(ownerId, input);
    const row = await upsertOrgProfileRow("aliado", ownerId, toWrite(input));
    // Si la empresa ya está publicada públicamente, estos campos pueden
    // cambiar lo que se ve en el Landing (sector, ciudad, logo, contacto...).
    triggerPublicRevalidate(PUBLIC_ALLIES_TAG);
    return rowToProfile(row);
  },
};

// ---------- autorizaciones de publicación / uso de logo (Supabase real, sin respaldo local) ----------

const AUTH_KEY_PREFIX = "hdv.aliadoAuthorizations.";

function readLocalAuthorizations(ownerId: string): OrgAuthorization[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${AUTH_KEY_PREFIX}${ownerId}`);
    return raw ? (JSON.parse(raw) as OrgAuthorization[]) : [];
  } catch {
    return [];
  }
}

function writeLocalAuthorization(ownerId: string, next: OrgAuthorization): void {
  try {
    const current = readLocalAuthorizations(ownerId).filter((a) => a.type !== next.type);
    window.localStorage.setItem(`${AUTH_KEY_PREFIX}${ownerId}`, JSON.stringify([...current, next]));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Autorizaciones vigentes (una por tipo) de la cuenta aliada autenticada. */
export async function fetchMyOrganizationAuthorizations(
  ownerId: string,
  supabase: SupabaseClient = createSupabaseBrowserClient(),
): Promise<OrgAuthorization[]> {
  if (!(await getSupabaseUserId())) return readLocalAuthorizations(ownerId);
  const { data, error } = await supabase.rpc("my_organization_authorizations");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    type: row.authorization_type as OrgAuthorizationType,
    status: row.status as OrgAuthorization["status"],
    policyVersion: String(row.policy_version),
    updatedAt: String(row.updated_at),
  }));
}

/**
 * Otorga o revoca una autorización (siempre queda un registro nuevo en el
 * historial del servidor; nunca se sobrescribe ni se borra). En modo
 * desarrollo sin sesión real, se guarda solo localmente para poder probar la
 * UI, sin pretender que eso equivale a un registro auditable.
 */
export async function setOrganizationAuthorization(
  ownerId: string,
  type: OrgAuthorizationType,
  granted: boolean,
  supabase: SupabaseClient = createSupabaseBrowserClient(),
): Promise<void> {
  if (!(await getSupabaseUserId())) {
    writeLocalAuthorization(ownerId, {
      type,
      status: granted ? "granted" : "revoked",
      policyVersion: "dev",
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  const { error } = await supabase.rpc("set_organization_authorization", {
    p_type: type,
    p_granted: granted,
  });
  if (error) throw error;
  // Otorgar o revocar cambia de inmediato qué se ve (o no) en el Landing.
  triggerPublicRevalidate(PUBLIC_ALLIES_TAG);
}
