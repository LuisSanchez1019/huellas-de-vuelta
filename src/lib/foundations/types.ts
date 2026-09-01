import type { ProfileStatus, VeterinaryLocation, VeterinarySocial } from "@/lib/veterinaries/types";

/**
 * Perfil de una fundación. `location` (con latitud/longitud) se usará para
 * ubicar a la fundación en el mapa de la landing.
 */
export interface FoundationProfile {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  logoUrl: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  social: VeterinarySocial;
  location: VeterinaryLocation;
  extraInfo: string;
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FoundationProfileInput {
  name: string;
  logoUrl: string;
  description: string;
  phone: string;
  whatsapp: string;
  email: string;
  social: VeterinarySocial;
  location: VeterinaryLocation;
  extraInfo: string;
  status: ProfileStatus;
}

export const EMPTY_FOUNDATION_INPUT: FoundationProfileInput = {
  name: "",
  logoUrl: "",
  description: "",
  phone: "",
  whatsapp: "",
  email: "",
  social: { facebook: "", instagram: "", whatsapp: "", website: "", tiktok: "" },
  location: { address: "", city: "", mapUrl: "", lat: null, lng: null },
  extraInfo: "",
  status: "draft",
};
