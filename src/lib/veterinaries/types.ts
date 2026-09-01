export type ProfileStatus = "draft" | "published";

export interface VeterinaryHours {
  day: string; // "Lunes a viernes", "Sábados", …
  open: string; // "08:00"
  close: string; // "18:00"
  closed: boolean;
}

export interface VeterinarySocial {
  facebook: string;
  instagram: string;
  whatsapp: string;
  website: string;
  tiktok: string;
}

export interface VeterinaryLocation {
  address: string;
  city: string;
  mapUrl: string; // enlace a Google Maps / OpenStreetMap
  lat: number | null;
  lng: number | null;
}

/**
 * Perfil público de una veterinaria. Pensado para servirse tal cual desde una
 * API en el futuro y renderizarse en la landing (listado + perfil individual).
 */
export interface VeterinaryProfile {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  logoUrl: string;
  coverImageUrl: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface VeterinaryProfileInput {
  name: string;
  logoUrl: string;
  coverImageUrl: string;
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

export const EMPTY_VETERINARY_INPUT: VeterinaryProfileInput = {
  name: "",
  logoUrl: "",
  coverImageUrl: "",
  description: "",
  phone: "",
  whatsapp: "",
  email: "",
  hours: [{ day: "Lunes a viernes", open: "08:00", close: "18:00", closed: false }],
  services: [],
  social: { facebook: "", instagram: "", whatsapp: "", website: "", tiktok: "" },
  location: { address: "", city: "", mapUrl: "", lat: null, lng: null },
  extraInfo: "",
  status: "draft",
};
