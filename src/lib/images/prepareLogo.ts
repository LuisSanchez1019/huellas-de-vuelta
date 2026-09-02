import { resizeImage } from "./resizeImage";

export const ALLOWED_LOGO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;

export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const LOGO_MAX_DIMENSION = 512;

export interface PreparedLogo {
  blob: Blob;
  contentType: string;
  previewUrl: string;
  /** "svg" = se conservó vectorial; "raster" = se optimizó como imagen. */
  kind: "svg" | "raster";
}

/**
 * Prepara el logo de una organización para subirlo a Storage.
 * - Si el archivo ya es SVG → se sanea (sin scripts ni referencias externas) y
 *   se conserva como vectorial.
 * - Si es raster (JPG/PNG/WebP) → se optimiza (máx 512 px, WebP/JPEG de alta
 *   calidad). Nunca se convierte una fotografía a SVG.
 */
export async function prepareLogo(file: File): Promise<PreparedLogo> {
  if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("Formato no permitido. Usa PNG, JPG, WebP o SVG.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("El archivo supera 2 MB. Elige uno más liviano.");
  }

  if (file.type === "image/svg+xml") {
    const raw = await file.text();
    const clean = sanitizeSvg(raw);
    const blob = new Blob([clean], { type: "image/svg+xml" });
    return {
      blob,
      contentType: "image/svg+xml",
      previewUrl: URL.createObjectURL(blob),
      kind: "svg",
    };
  }

  const resized = await resizeImage(file, { maxDimension: LOGO_MAX_DIMENSION });
  return {
    blob: resized.blob,
    contentType: resized.contentType,
    previewUrl: resized.previewUrl,
    kind: "raster",
  };
}

/**
 * Saneado básico de SVG antes de guardarlo: elimina scripts, manejadores de
 * eventos, `<foreignObject>` y referencias a recursos externos. Se apoya en
 * DOMParser (disponible en el navegador).
 */
function sanitizeSvg(source: string): string {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    throw new Error("El archivo SVG no es válido.");
  }

  svg.querySelectorAll("script, foreignObject, iframe, style").forEach((node) => node.remove());

  const walker = doc.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
  const nodes: Element[] = [svg];
  while (walker.nextNode()) nodes.push(walker.currentNode as Element);

  for (const el of nodes) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (name === "href" || name === "xlink:href" || name === "src") &&
        !value.startsWith("#") &&
        !value.startsWith("data:image/")
      ) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (value.includes("javascript:")) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return new XMLSerializer().serializeToString(svg);
}
