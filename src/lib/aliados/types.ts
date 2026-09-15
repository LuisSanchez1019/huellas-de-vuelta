export type ApprovalStatus = "pending" | "approved" | "rejected";

export type OrgAuthorizationType = "public_info" | "logo_usage";
export type OrgAuthorizationStatus = "granted" | "revoked";

export interface OrgAuthorization {
  type: OrgAuthorizationType;
  status: OrgAuthorizationStatus;
  policyVersion: string;
  updatedAt: string;
}

/**
 * Perfil empresarial de una cuenta aliada: identidad, información y contacto
 * empresarial, separados de los datos personales de la cuenta que administra
 * el perfil (esos viven en `profiles`, no aquí).
 */
export interface AliadoProfile {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  legalName: string;
  description: string;
  logoUrl: string;
  logoPath: string;
  sectorId: string | null;
  country: string;
  city: string;
  address: string;
  mapUrl: string;
  website: string;
  email: string;
  phone: string;
  mobilePhone: string;
  whatsapp: string;
  status: "draft" | "published";
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface AliadoProfileInput {
  name: string;
  legalName: string;
  description: string;
  logoUrl: string;
  logoPath: string;
  sectorId: string | null;
  country: string;
  city: string;
  address: string;
  mapUrl: string;
  website: string;
  email: string;
  phone: string;
  mobilePhone: string;
  whatsapp: string;
}

export const EMPTY_ALIADO_INPUT: AliadoProfileInput = {
  name: "",
  legalName: "",
  description: "",
  logoUrl: "",
  logoPath: "",
  sectorId: null,
  country: "Colombia",
  city: "",
  address: "",
  mapUrl: "",
  website: "",
  email: "",
  phone: "",
  mobilePhone: "",
  whatsapp: "",
};
