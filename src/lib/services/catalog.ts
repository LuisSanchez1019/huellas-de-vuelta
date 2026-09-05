import type { OrgProfileKind } from "@/lib/supabase/orgProfiles";

/**
 * Claves de icono para servicios. Deben existir como `Record` en
 * `src/components/icons/Icon.tsx` (componente `ServiceIcon`).
 */
export type ServiceIconKey =
  | "stethoscope"
  | "alert"
  | "syringe"
  | "cross"
  | "bed"
  | "search"
  | "tooth"
  | "scissors"
  | "pill"
  | "home"
  | "tag"
  | "hand"
  | "heart"
  | "activity"
  | "bowl"
  | "paw"
  | "report"
  | "book";

export interface ServiceCatalogItem {
  id: string;
  kind: OrgProfileKind;
  slug: string;
  name: string;
  icon: ServiceIconKey;
  sortOrder: number;
}

/**
 * Catálogo fijo de servicios por tipo de organización. Los `id` son los uuid
 * reales sembrados en `public.service_catalog` (migración
 * `add_service_catalog_and_organization_services`): si el catálogo cambia,
 * debe actualizarse ahí primero y luego reflejarse aquí.
 */
export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  { id: "30ecd0fa-da2a-4791-b501-6b22a29bf0c4", kind: "veterinaria", slug: "consulta", name: "Consulta veterinaria", icon: "stethoscope", sortOrder: 1 },
  { id: "50c6c7b7-c758-47ad-9f21-185e06e21290", kind: "veterinaria", slug: "urgencias", name: "Urgencias", icon: "alert", sortOrder: 2 },
  { id: "cbd96d1e-d289-4525-94c0-eac817822c56", kind: "veterinaria", slug: "vacunacion", name: "Vacunación", icon: "syringe", sortOrder: 3 },
  { id: "caf50bed-e626-43c3-a7d2-7f8cc8a9c188", kind: "veterinaria", slug: "cirugia", name: "Cirugía", icon: "cross", sortOrder: 4 },
  { id: "a100893d-8239-4c58-b4d8-4c9fb704101e", kind: "veterinaria", slug: "hospitalizacion", name: "Hospitalización", icon: "bed", sortOrder: 5 },
  { id: "fce22703-4047-492d-a0ee-fc784965140c", kind: "veterinaria", slug: "diagnostico", name: "Diagnóstico y exámenes", icon: "search", sortOrder: 6 },
  { id: "dbd285c2-7caa-481a-853f-7edd966d9395", kind: "veterinaria", slug: "odontologia", name: "Odontología", icon: "tooth", sortOrder: 7 },
  { id: "1b1707d1-6bfe-43d6-9ce9-fc16cc942c89", kind: "veterinaria", slug: "peluqueria", name: "Peluquería y estética", icon: "scissors", sortOrder: 8 },
  { id: "c1bcea66-4fcc-4d2e-840c-56f2f6093919", kind: "veterinaria", slug: "farmacia", name: "Farmacia veterinaria", icon: "pill", sortOrder: 9 },
  { id: "7c70b101-675c-4c13-b0a1-cdf06a2699fb", kind: "veterinaria", slug: "domicilio", name: "Atención a domicilio", icon: "home", sortOrder: 10 },
  { id: "61857833-dbf8-4600-b8e8-25281a925a31", kind: "veterinaria", slug: "otros", name: "Otros servicios", icon: "tag", sortOrder: 11 },

  { id: "ea8e9c5a-ddb2-4def-9991-48cc18723f47", kind: "fundacion", slug: "rescate", name: "Rescate", icon: "hand", sortOrder: 1 },
  { id: "fd2f4488-c7fd-4e0b-9d55-afb77c70645a", kind: "fundacion", slug: "adopcion", name: "Adopción", icon: "heart", sortOrder: 2 },
  { id: "cc259fa9-bbb9-41a1-b90c-ba71409729eb", kind: "fundacion", slug: "hogar-de-paso", name: "Hogar de paso", icon: "home", sortOrder: 3 },
  { id: "300702ea-6d13-4141-8b4f-e7da358d047d", kind: "fundacion", slug: "esterilizacion", name: "Esterilización", icon: "cross", sortOrder: 4 },
  { id: "2a59b14b-dc13-4a23-90db-8bb3eda4b3cb", kind: "fundacion", slug: "vacunacion", name: "Vacunación", icon: "syringe", sortOrder: 5 },
  { id: "dc3a5f68-66d6-4220-b9e4-52386ee5b23b", kind: "fundacion", slug: "recuperacion", name: "Recuperación y rehabilitación", icon: "activity", sortOrder: 6 },
  { id: "ae68bbfc-720b-4eb5-8f00-159708335c13", kind: "fundacion", slug: "alimentacion", name: "Alimentación", icon: "bowl", sortOrder: 7 },
  { id: "45b639d3-9961-477b-8481-b80ec226a709", kind: "fundacion", slug: "recepcion", name: "Recepción de animales", icon: "paw", sortOrder: 8 },
  { id: "d6163641-0d0c-43d7-9445-584af81fb160", kind: "fundacion", slug: "apoyo-mascotas-perdidas", name: "Apoyo a mascotas perdidas", icon: "report", sortOrder: 9 },
  { id: "8e24eebc-fb2c-4ee2-9e0c-8e194429bf73", kind: "fundacion", slug: "educacion", name: "Educación y bienestar animal", icon: "book", sortOrder: 10 },
  { id: "45429883-002a-4065-9f87-1dd9e4b905b1", kind: "fundacion", slug: "otros", name: "Otros servicios", icon: "tag", sortOrder: 11 },
];

/** Catálogo de un tipo de organización, ordenado para mostrarse. */
export function getServiceCatalog(kind: OrgProfileKind): ServiceCatalogItem[] {
  return SERVICE_CATALOG.filter((item) => item.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getServiceById(id: string): ServiceCatalogItem | undefined {
  return SERVICE_CATALOG.find((item) => item.id === id);
}
