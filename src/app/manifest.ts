import type { MetadataRoute } from "next";

/**
 * Web App Manifest (convención de Next.js 16: se sirve en `/manifest.webmanifest`
 * y Next inyecta `<link rel="manifest">` automáticamente).
 *
 * Sustituye al `site.webmanifest` del pack de favicons, que venía con `name` y
 * `short_name` vacíos y colores genéricos (`#ffffff`). Aquí se usan los valores
 * reales del proyecto: el nombre de `metadata` en `layout.tsx` y los colores de
 * la capa semántica de `globals.css` (`--bg: #f4f8fa`). Los iconos son los del
 * pack (`android-chrome-*`), servidos desde `public/`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Huellas de Vuelta",
    short_name: "Huellas de Vuelta",
    description: "Una plataforma para ayudar a las mascotas a volver a casa.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f8fa",
    theme_color: "#f4f8fa",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
