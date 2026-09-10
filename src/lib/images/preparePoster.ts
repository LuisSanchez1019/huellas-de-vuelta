/**
 * Prepara la imagen de un POSTER para subirla a Storage.
 *
 * Formato definitivo del poster: banner horizontal 1200 x 400 px (proporcion 3:1),
 * la medida que encaja en el contenedor real de la Landing (`.sectionInner`,
 * max-width 78rem). Se usa la MISMA proporcion en uploader, validacion, vista
 * previa, almacenamiento y Landing.
 *
 * - Formatos: JPG / JPEG / PNG / WebP. Nada mas (ni GIF, ni SVG, ni PDF).
 * - Peso maximo del archivo original: 3 MB.
 * - La imagen se recorta al centro a 3:1 (nunca se deforma) y se exporta como
 *   WebP de alta calidad (fallback JPEG). `wasCropped` avisa a la UI cuando la
 *   proporcion de origen no era ~3:1 para mostrarlo en la vista previa.
 */

export const POSTER_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const POSTER_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
export const POSTER_WIDTH = 1200;
export const POSTER_HEIGHT = 400;
export const POSTER_RATIO = POSTER_WIDTH / POSTER_HEIGHT; // 3
export const POSTER_RECOMMENDED_LABEL = "1200 × 400 px";

export interface PreparedPoster {
  blob: Blob;
  contentType: "image/webp" | "image/jpeg";
  previewUrl: string;
  wasCropped: boolean;
  sourceWidth: number;
  sourceHeight: number;
}

export async function preparePoster(file: File): Promise<PreparedPoster> {
  if (!(POSTER_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("El formato del poster no es válido. Usa JPG, PNG o WebP.");
  }
  if (file.size > POSTER_MAX_BYTES) {
    throw new Error("El poster supera el tamaño máximo permitido de 3 MB.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const { width: iw, height: ih } = image;
    if (!iw || !ih) throw new Error("El archivo no es una imagen válida.");

    // Recorte "cover" centrado a proporcion 3:1 (sin deformar).
    let sw = iw;
    let sh = ih;
    if (iw / ih > POSTER_RATIO) {
      sw = Math.round(ih * POSTER_RATIO);
    } else {
      sh = Math.round(iw / POSTER_RATIO);
    }
    const sx = Math.round((iw - sw) / 2);
    const sy = Math.round((ih - sh) / 2);
    const wasCropped = Math.abs(iw / ih - POSTER_RATIO) > 0.02;

    const canvas = document.createElement("canvas");
    canvas.width = POSTER_WIDTH;
    canvas.height = POSTER_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No fue posible procesar la imagen en este navegador.");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sx, sy, sw, sh, 0, 0, POSTER_WIDTH, POSTER_HEIGHT);

    let contentType: PreparedPoster["contentType"] = "image/webp";
    let blob = await canvasToBlob(canvas, contentType, 0.85);
    if (!blob) {
      contentType = "image/jpeg";
      blob = await canvasToBlob(canvas, contentType, 0.85);
    }
    if (!blob) throw new Error("No fue posible procesar la imagen.");

    return {
      blob,
      contentType,
      previewUrl: URL.createObjectURL(blob),
      wasCropped,
      sourceWidth: iw,
      sourceHeight: ih,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("El archivo no es una imagen válida."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}
