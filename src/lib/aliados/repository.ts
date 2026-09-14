import { getSupabaseUserId } from "@/lib/auth/session";
import {
  fetchOrgProfileRow,
  upsertOrgProfileRow,
  type OrgProfileRow,
  type OrgProfileWrite,
} from "@/lib/supabase/orgProfiles";
import type { AliadoProfile, AliadoProfileInput, ApprovalStatus } from "./types";

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
    description: "",
    phone: "",
    whatsapp: "",
    email: "",
    hours: [],
    social: {},
    address: input.address,
    city: input.city,
    neighborhood: "",
    mapUrl: "",
    lat: null,
    lng: null,
    extraInfo: "",
    // El directorio público de aliados todavía no existe; se guarda publicado
    // para que, cuando exista, no haga falta un paso adicional de "publicar".
    status: "published",
    country: input.country,
  };
}

function rowToProfile(row: OrgProfileRow): AliadoProfile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url ?? "",
    logoPath: row.logo_path ?? "",
    country: row.country ?? "",
    city: row.city ?? "",
    address: row.address ?? "",
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
    return rowToProfile(row);
  },
};
