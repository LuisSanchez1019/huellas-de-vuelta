export interface BusinessSector {
  id: string;
  slug: string;
  name: string;
}

/**
 * Catálogo fijo de sectores empresariales para el perfil de aliado. Categorías
 * generales derivadas de la clasificación económica vigente de DANE (CIIU Rev.
 * 5 A.C.), simplificadas para no exigir conocer códigos CIIU. Los `id` son los
 * uuid reales sembrados en `public.business_sectors` (migración
 * `aliado_business_profile_and_authorizations`): si el catálogo cambia, debe
 * actualizarse ahí primero y luego reflejarse aquí (mismo patrón que
 * `SERVICE_CATALOG` en `@/lib/services/catalog`).
 */
export const BUSINESS_SECTORS: BusinessSector[] = [
  { id: "c70a1d4c-4222-4b60-a1e2-4c49bcab7a7d", slug: "agricultura-ganaderia-silvicultura-pesca", name: "Agricultura, ganadería, silvicultura y pesca" },
  { id: "39834379-542a-4fa4-99d0-cb5a4f2ebf58", slug: "explotacion-minas-canteras", name: "Explotación de minas y canteras" },
  { id: "aff84288-cb38-465e-9ad6-7bc61f63a32b", slug: "industrias-manufactureras", name: "Industrias manufactureras" },
  { id: "b34d0814-1c17-4f77-88af-d84fd61afc33", slug: "electricidad-gas-servicios-publicos", name: "Suministro de electricidad, gas y otros servicios públicos" },
  { id: "b1affff4-28a9-4bc0-84d5-546ed2a2808a", slug: "agua-saneamiento-residuos", name: "Agua, saneamiento y gestión de residuos" },
  { id: "8f46cac6-82e2-4400-8c42-900ce10fa66d", slug: "construccion", name: "Construcción" },
  { id: "3aec990d-e343-4a3d-87ce-abee3d439bc9", slug: "comercio", name: "Comercio" },
  { id: "83ca93c5-e89d-4517-8e11-58b4d20b235d", slug: "transporte-almacenamiento", name: "Transporte y almacenamiento" },
  { id: "7314653e-ff43-4cf2-b2d3-9a226709b1b1", slug: "alojamiento-servicios-comida", name: "Alojamiento y servicios de comida" },
  { id: "e75a634e-e769-4d8f-a31a-3881bda7eca1", slug: "informacion-comunicaciones", name: "Información y comunicaciones" },
  { id: "c1f73582-ccf2-45e6-b70c-4de570c903ba", slug: "financieras-seguros", name: "Actividades financieras y de seguros" },
  { id: "9221d9d1-6a46-400f-9df4-e6c88e679477", slug: "inmobiliarias", name: "Actividades inmobiliarias" },
  { id: "679ce85f-6410-489f-a3ea-bd8386a79014", slug: "profesionales-cientificas-tecnicas", name: "Actividades profesionales, científicas y técnicas" },
  { id: "f7fa1a3f-a87e-4f4c-b83d-1cf44740a49f", slug: "administrativos-apoyo", name: "Servicios administrativos y de apoyo" },
  { id: "ad860b50-59c4-492b-9b83-298bbf0c39ce", slug: "administracion-publica-defensa", name: "Administración pública y defensa" },
  { id: "e8dc2ef9-0732-4419-bbe0-d64d514c22dc", slug: "educacion", name: "Educación" },
  { id: "77f86e3d-fdf0-41f5-9d88-5c7481f549e1", slug: "salud-asistencia-social", name: "Salud y asistencia social" },
  { id: "4340333e-b554-4e65-943c-60e2afafcb4e", slug: "artisticas-entretenimiento-recreacion", name: "Actividades artísticas, de entretenimiento y recreación" },
  { id: "167d00d8-e794-476c-b125-a851be77bec5", slug: "otras-actividades-servicios", name: "Otras actividades de servicios" },
  { id: "a1679c5b-4dab-4acf-9037-b781688141d4", slug: "otro", name: "Otro" },
];

export function getBusinessSectorById(id: string | null | undefined): BusinessSector | undefined {
  return id ? BUSINESS_SECTORS.find((s) => s.id === id) : undefined;
}
