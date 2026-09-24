import { getSupabaseUserId } from "@/lib/auth/session";
import {
  fetchOrgProfileRow,
  upsertOrgProfileRow,
  type OrgProfileRow,
  type OrgProfileWrite,
} from "@/lib/supabase/orgProfiles";
import type { ApprovalStatus, ProveedorProfile, ProveedorProfileInput } from "./types";

/**
 * Perfil de la cuenta proveedora (Supabase con sesión real; localStorage como
 * respaldo en modo desarrollo sin sesión, igual que veterinaria/fundación/aliado).
 */
export interface ProveedorRepository {
  getMine(ownerId: string): Promise<ProveedorProfile | null>;
  saveMine(ownerId: string, input: ProveedorProfileInput): Promise<ProveedorProfile>;
}

const KEY_PREFIX = "hdv.proveedorProfile.";

function toWrite(input: ProveedorProfileInput): OrgProfileWrite {
  return {
    name: input.name,
    category: "proveedor",
    logoUrl: "",
    logoPath: "",
    coverImageUrl: "",
    description: "",
    phone: input.phone,
    whatsapp: input.whatsapp,
    email: input.email,
    hours: [],
    social: {},
    address: "",
    city: "",
    neighborhood: "",
    mapUrl: "",
    lat: null,
    lng: null,
    extraInfo: "",
    // Sin directorio público: queda en borrador. No hay hoy ninguna lectura
    // pública que dependa de este campo para kind = 'proveedor'.
    status: "draft",
  };
}

function rowToProfile(row: OrgProfileRow): ProveedorProfile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
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

function read(ownerId: string): ProveedorProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${ownerId}`);
    return raw ? (JSON.parse(raw) as ProveedorProfile) : null;
  } catch {
    return null;
  }
}

function write(ownerId: string, profile: ProveedorProfile): void {
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${ownerId}`, JSON.stringify(profile));
  } catch {
    /* almacenamiento no disponible */
  }
}

const local: ProveedorRepository = {
  async getMine(ownerId) {
    return read(ownerId);
  },
  async saveMine(ownerId, input) {
    const existing = read(ownerId);
    const now = new Date().toISOString();
    const profile: ProveedorProfile = {
      id: existing?.id ?? `proveedor_${ownerId}`,
      ownerId,
      slug: existing?.slug ?? "proveedor",
      status: existing?.status ?? "draft",
      approvalStatus: existing?.approvalStatus ?? "pending",
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

export const proveedorRepository: ProveedorRepository = {
  async getMine(ownerId) {
    if (!(await getSupabaseUserId())) return local.getMine(ownerId);
    const row = await fetchOrgProfileRow("proveedor", ownerId);
    return row ? rowToProfile(row) : null;
  },
  async saveMine(ownerId, input) {
    if (!(await getSupabaseUserId())) return local.saveMine(ownerId, input);
    const row = await upsertOrgProfileRow("proveedor", ownerId, toWrite(input));
    return rowToProfile(row);
  },
};
