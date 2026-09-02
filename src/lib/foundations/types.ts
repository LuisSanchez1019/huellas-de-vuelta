import type {
  ApprovalStatus,
  OrgCategory,
  ProfileStatus,
  VeterinaryHours,
  VeterinaryLocation,
  VeterinarySocial,
} from "@/lib/veterinaries/types";

/**
 * Perfil de una fundación. `location` (con latitud/longitud) se usará para
 * ubicar a la fundación en el mapa de la landing.
 */
export interface FoundationProfile {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  category: OrgCategory;
  logoUrl: string;
  logoPath: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: VeterinaryHours[];
  services: string[];
  social: VeterinarySocial;
  location: VeterinaryLocation;
  extraInfo: string;
  status: ProfileStatus;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface FoundationProfileInput {
  name: string;
  category: OrgCategory;
  logoUrl: string;
  logoPath: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: VeterinaryHours[];
  services: string[];
  social: VeterinarySocial;
  location: VeterinaryLocation;
  extraInfo: string;
  status: ProfileStatus;
}

export const EMPTY_FOUNDATION_INPUT: FoundationProfileInput = {
  name: "",
  category: "fundacion",
  logoUrl: "",
  logoPath: "",
  description: "",
  phone: "",
  whatsapp: "",
  email: "",
  hours: [{ day: "Lunes a viernes", open: "08:00", close: "18:00", closed: false }],
  services: [],
  social: { facebook: "", instagram: "", whatsapp: "", website: "", tiktok: "" },
  location: { address: "", city: "", neighborhood: "", mapUrl: "", lat: null, lng: null },
  extraInfo: "",
  status: "draft",
};
