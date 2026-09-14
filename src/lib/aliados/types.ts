export type ApprovalStatus = "pending" | "approved" | "rejected";

/**
 * Perfil de una cuenta aliada. Deliberadamente más simple que el de
 * veterinaria/fundación: solo lo necesario para presentar la empresa (logo,
 * nombre, país, ciudad, dirección). Sin horarios, catálogo de servicios ni
 * redes sociales — eso pertenece a veterinarias/fundaciones.
 */
export interface AliadoProfile {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  logoUrl: string;
  logoPath: string;
  country: string;
  city: string;
  address: string;
  status: "draft" | "published";
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface AliadoProfileInput {
  name: string;
  logoUrl: string;
  logoPath: string;
  country: string;
  city: string;
  address: string;
}

export const EMPTY_ALIADO_INPUT: AliadoProfileInput = {
  name: "",
  logoUrl: "",
  logoPath: "",
  country: "Colombia",
  city: "",
  address: "",
};
