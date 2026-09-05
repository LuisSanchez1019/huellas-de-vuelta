import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Permite indexar el contenido público (Landing, ayuda, demo) y bloquea las
 * áreas autenticadas (dashboard/paneles/admin/auth), que de todos modos no
 * muestran nada sin sesión pero no aportan valor de búsqueda.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/veterinaria", "/fundacion", "/admin", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
