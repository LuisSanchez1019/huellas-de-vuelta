export type ApprovalStatus = "pending" | "approved" | "rejected";

/**
 * Perfil de la empresa/proveedor: identidad y contacto comercial, separados
 * de los datos personales de la cuenta que lo administra (esos viven en
 * `profiles`, no aquí). Deliberadamente mínimo: el proveedor todavía no tiene
 * directorio público ni funciones de QR (llegan en un bloque posterior).
 */
export interface ProveedorProfile {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  status: "draft" | "published";
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProveedorProfileInput {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
}

export const EMPTY_PROVEEDOR_INPUT: ProveedorProfileInput = {
  name: "",
  email: "",
  phone: "",
  whatsapp: "",
};
