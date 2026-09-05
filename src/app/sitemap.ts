import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Solo rutas públicas ESTABLES. A propósito no incluye páginas individuales
 * de mascotas (`/m/<publicId>`) ni de organizaciones: son numerosas,
 * cambian de estado con el tiempo (una mascota perdida vuelve a casa) y no
 * aportan valor de indexación permanente — mejor no listarlas todas aquí.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/ayuda", "/mascota/demo"];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
