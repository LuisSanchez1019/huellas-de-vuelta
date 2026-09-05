import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgApprovalStatus, OrgCategory } from "@/lib/pets/reencuentro";
import { PUBLIC_ORGS_TAG, triggerPublicRevalidate } from "@/lib/cache/tags";

/** Fila que devuelve `admin_list_organizations()` (solo admin). */
export interface AdminOrganization {
  id: string;
  ownerId: string;
  ownerDisplayName: string | null;
  ownerEmail: string | null;
  kind: string;
  category: OrgCategory;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  approvalStatus: OrgApprovalStatus;
  isActive: boolean;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export async function adminListOrganizations(
  supabase: SupabaseClient,
): Promise<AdminOrganization[]> {
  const { data, error } = await supabase.rpc("admin_list_organizations");
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    ownerId: String(row.owner_id),
    ownerDisplayName: (row.owner_display_name as string) ?? null,
    ownerEmail: (row.owner_email as string) ?? null,
    kind: String(row.kind ?? ""),
    category: (row.category as OrgCategory) ?? "otro_aliado",
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: (row.description as string) ?? null,
    phone: (row.phone as string) ?? null,
    whatsapp: (row.whatsapp as string) ?? null,
    email: (row.email as string) ?? null,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    neighborhood: (row.neighborhood as string) ?? null,
    lat: (row.lat as number) ?? null,
    lng: (row.lng as number) ?? null,
    status: String(row.status ?? "draft"),
    approvalStatus: (row.approval_status as OrgApprovalStatus) ?? "pending",
    isActive: Boolean(row.is_active),
    verifiedAt: (row.verified_at as string) ?? null,
    rejectionReason: (row.rejection_reason as string) ?? null,
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function setOrgApproval(
  supabase: SupabaseClient,
  orgId: string,
  status: OrgApprovalStatus,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("set_org_approval", {
    p_org_id: orgId,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  // La organización puede empezar/dejar de aparecer en Landing/mapa: invalidar
  // después de responder, no antes (la escritura ya quedó confirmada arriba).
  triggerPublicRevalidate(PUBLIC_ORGS_TAG);
}

/** Desactiva o reactiva una organización (solo admin, vía RPC `set_org_active`). */
export async function setOrgActive(
  supabase: SupabaseClient,
  orgId: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("set_org_active", {
    p_org_id: orgId,
    p_active: active,
  });
  if (error) throw error;
  triggerPublicRevalidate(PUBLIC_ORGS_TAG);
}
