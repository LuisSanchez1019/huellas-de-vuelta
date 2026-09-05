import { mockFoundations } from "@/data/mock";
import { getSupabaseUserId } from "@/lib/auth/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchOrgProfileRow,
  fetchOrgServiceIds,
  listPublishedOrgProfileRows,
  replaceOrgServices,
  upsertOrgProfileRow,
  type OrgProfileRow,
  type OrgProfileWrite,
} from "@/lib/supabase/orgProfiles";
import { PUBLIC_ORGS_TAG, triggerPublicRevalidate } from "@/lib/cache/tags";
import type { FoundationProfile, FoundationProfileInput } from "./types";
import type { OrgCategory, VeterinaryHours, VeterinarySocial } from "@/lib/veterinaries/types";

export interface FoundationRepository {
  getMine(ownerId: string): Promise<FoundationProfile | null>;
  saveMine(ownerId: string, input: FoundationProfileInput): Promise<FoundationProfile>;
  listPublic(): Promise<FoundationProfile[]>;
}

const KEY_PREFIX = "hdv.foundationProfile.";
const EMPTY_SOCIAL: VeterinarySocial = { facebook: "", instagram: "", whatsapp: "", website: "", tiktok: "" };

function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "fundacion";
}

function toWrite(input: FoundationProfileInput): OrgProfileWrite {
  return {
    name: input.name,
    category: input.category,
    logoUrl: input.logoUrl,
    logoPath: input.logoPath,
    coverImageUrl: "",
    description: input.description,
    phone: input.phone,
    whatsapp: input.whatsapp,
    email: input.email,
    hours: input.hours,
    social: { ...input.social },
    address: input.location.address,
    city: input.location.city,
    neighborhood: input.location.neighborhood,
    mapUrl: input.location.mapUrl,
    lat: input.location.lat,
    lng: input.location.lng,
    extraInfo: input.extraInfo,
    status: input.status,
  };
}

function rowToProfile(row: OrgProfileRow, serviceIds: string[]): FoundationProfile {
  const social = (row.social ?? {}) as Partial<VeterinarySocial>;
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    category: toOrgCategory(row.category),
    logoUrl: row.logo_url ?? "",
    logoPath: row.logo_path ?? "",
    description: row.description ?? "",
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    email: row.email ?? "",
    hours: Array.isArray(row.hours) ? (row.hours as unknown as VeterinaryHours[]) : [],
    services: serviceIds,
    social: { ...EMPTY_SOCIAL, ...social },
    location: {
      address: row.address ?? "",
      city: row.city ?? "",
      neighborhood: row.neighborhood ?? "",
      mapUrl: row.map_url ?? "",
      lat: row.lat,
      lng: row.lng,
    },
    extraInfo: row.extra_info ?? "",
    status: row.status === "published" ? "published" : "draft",
    approvalStatus:
      row.approval_status === "approved" || row.approval_status === "rejected"
        ? row.approval_status
        : "pending",
    isActive: row.is_active !== false,
    rejectionReason: row.rejection_reason ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toOrgCategory(value: string | null): OrgCategory {
  return value === "veterinaria" ||
    value === "fundacion" ||
    value === "refugio" ||
    value === "otro_aliado"
    ? value
    : "fundacion";
}

function read(ownerId: string): FoundationProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}${ownerId}`);
    return raw ? (JSON.parse(raw) as FoundationProfile) : null;
  } catch {
    return null;
  }
}

function seedPublic(): FoundationProfile[] {
  const now = new Date().toISOString();
  return mockFoundations.map((foundation) => ({
    id: `seed-${foundation.id}`,
    ownerId: `seed-${foundation.id}`,
    slug: foundation.id,
    name: foundation.name,
    category: "fundacion",
    logoUrl: "",
    logoPath: "",
    description: `${foundation.kind} aliada de Huellas de Vuelta.`,
    phone: "",
    whatsapp: "",
    email: "",
    hours: [],
    services: [],
    social: { ...EMPTY_SOCIAL },
    location: { address: "", city: "", neighborhood: "", mapUrl: "", lat: null, lng: null },
    extraInfo: "",
    status: "published",
    approvalStatus: "approved",
    isActive: true,
    rejectionReason: "",
    createdAt: now,
    updatedAt: now,
  }));
}

const local: FoundationRepository = {
  async getMine(ownerId) {
    return read(ownerId);
  },
  async saveMine(ownerId, input) {
    const existing = read(ownerId);
    const now = new Date().toISOString();
    const profile: FoundationProfile = {
      id: existing?.id ?? `fnd_${ownerId}`,
      ownerId,
      slug: slugify(input.name),
      approvalStatus: existing?.approvalStatus ?? "approved",
      isActive: existing?.isActive ?? true,
      rejectionReason: existing?.rejectionReason ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...input,
    };
    try {
      window.localStorage.setItem(`${KEY_PREFIX}${ownerId}`, JSON.stringify(profile));
    } catch {
      /* almacenamiento no disponible */
    }
    return profile;
  },
  async listPublic() {
    return seedPublic();
  },
};

export const foundationRepository: FoundationRepository = {
  async getMine(ownerId) {
    if (!(await getSupabaseUserId())) return local.getMine(ownerId);
    const row = await fetchOrgProfileRow("fundacion", ownerId);
    if (!row) return null;
    const serviceIds = await fetchOrgServiceIds(createSupabaseBrowserClient(), row.id);
    return rowToProfile(row, serviceIds);
  },
  async saveMine(ownerId, input) {
    if (!(await getSupabaseUserId())) return local.saveMine(ownerId, input);
    const row = await upsertOrgProfileRow("fundacion", ownerId, toWrite(input));
    const supabase = createSupabaseBrowserClient();
    await replaceOrgServices(supabase, row.id, input.services);
    triggerPublicRevalidate(PUBLIC_ORGS_TAG);
    return rowToProfile(row, input.services);
  },
  async listPublic() {
    try {
      const rows = await listPublishedOrgProfileRows("fundacion");
      return rows.map((row) => rowToProfile(row, []));
    } catch {
      return local.listPublic();
    }
  },
};
