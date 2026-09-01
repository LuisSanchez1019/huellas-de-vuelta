import { mockVeterinaries } from "@/data/mock";
import { getSupabaseUserId } from "@/lib/auth/session";
import {
  fetchOrgProfileRow,
  listPublishedOrgProfileRows,
  upsertOrgProfileRow,
  type OrgProfileRow,
  type OrgProfileWrite,
} from "@/lib/supabase/orgProfiles";
import type {
  VeterinaryHours,
  VeterinaryProfile,
  VeterinaryProfileInput,
  VeterinarySocial,
} from "./types";

/**
 * Acceso a datos de perfiles de veterinaria. `listPublic()` es el punto único
 * que la landing consumirá para el listado y el perfil individual.
 */
export interface VeterinaryRepository {
  getMine(ownerId: string): Promise<VeterinaryProfile | null>;
  saveMine(ownerId: string, input: VeterinaryProfileInput): Promise<VeterinaryProfile>;
  listPublic(): Promise<VeterinaryProfile[]>;
}

const KEY_PREFIX = "hdv.vetProfile.";
const EMPTY_SOCIAL: VeterinarySocial = { facebook: "", instagram: "", whatsapp: "", website: "", tiktok: "" };

function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "veterinaria";
}

// ---------- mapeadores fila <-> dominio ----------

function toWrite(input: VeterinaryProfileInput): OrgProfileWrite {
  return {
    name: input.name,
    logoUrl: input.logoUrl,
    coverImageUrl: input.coverImageUrl,
    description: input.description,
    phone: input.phone,
    whatsapp: input.whatsapp,
    email: input.email,
    hours: input.hours,
    services: input.services,
    social: { ...input.social },
    address: input.location.address,
    city: input.location.city,
    mapUrl: input.location.mapUrl,
    lat: input.location.lat,
    lng: input.location.lng,
    extraInfo: input.extraInfo,
    status: input.status,
  };
}

function rowToProfile(row: OrgProfileRow): VeterinaryProfile {
  const social = (row.social ?? {}) as Partial<VeterinarySocial>;
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url ?? "",
    coverImageUrl: row.cover_image_url ?? "",
    description: row.description ?? "",
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    email: row.email ?? "",
    hours: Array.isArray(row.hours) ? (row.hours as unknown as VeterinaryHours[]) : [],
    services: Array.isArray(row.services) ? row.services : [],
    social: { ...EMPTY_SOCIAL, ...social },
    location: {
      address: row.address ?? "",
      city: row.city ?? "",
      mapUrl: row.map_url ?? "",
      lat: row.lat,
      lng: row.lng,
    },
    extraInfo: row.extra_info ?? "",
    status: row.status === "published" ? "published" : "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------- implementación local (localStorage) ----------

function read(ownerId: string): VeterinaryProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${ownerId}`);
    return raw ? (JSON.parse(raw) as VeterinaryProfile) : null;
  } catch {
    return null;
  }
}

function write(ownerId: string, profile: VeterinaryProfile): void {
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${ownerId}`, JSON.stringify(profile));
  } catch {
    /* almacenamiento no disponible */
  }
}

function seedPublic(): VeterinaryProfile[] {
  const now = new Date().toISOString();
  return mockVeterinaries.map((vet) => ({
    id: `seed-${vet.id}`,
    ownerId: `seed-${vet.id}`,
    slug: vet.id,
    name: vet.name,
    logoUrl: "",
    coverImageUrl: "",
    description: vet.description,
    phone: "",
    whatsapp: "",
    email: "",
    hours: [{ day: "Lunes a viernes", open: "08:00", close: "18:00", closed: false }],
    services: [],
    social: { ...EMPTY_SOCIAL },
    location: { address: "", city: vet.city, mapUrl: "", lat: null, lng: null },
    extraInfo: "",
    status: "published",
    createdAt: now,
    updatedAt: now,
  }));
}

const local: VeterinaryRepository = {
  async getMine(ownerId) {
    return read(ownerId);
  },
  async saveMine(ownerId, input) {
    const existing = read(ownerId);
    const now = new Date().toISOString();
    const profile: VeterinaryProfile = {
      id: existing?.id ?? `vet_${ownerId}`,
      ownerId,
      slug: slugify(input.name),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...input,
    };
    write(ownerId, profile);
    return profile;
  },
  async listPublic() {
    return seedPublic();
  },
};

// ---------- adaptador: Supabase con sesión real, localStorage sin ella ----------

export const veterinaryRepository: VeterinaryRepository = {
  async getMine(ownerId) {
    if (!(await getSupabaseUserId())) return local.getMine(ownerId);
    const row = await fetchOrgProfileRow("veterinaria", ownerId);
    return row ? rowToProfile(row) : null;
  },
  async saveMine(ownerId, input) {
    if (!(await getSupabaseUserId())) return local.saveMine(ownerId, input);
    const row = await upsertOrgProfileRow("veterinaria", ownerId, toWrite(input));
    return rowToProfile(row);
  },
  async listPublic() {
    try {
      const rows = await listPublishedOrgProfileRows("veterinaria");
      return rows.map(rowToProfile);
    } catch {
      return local.listPublic();
    }
  },
};
