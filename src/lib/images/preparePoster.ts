/**
 * Preparación de la imagen de un POSTER.
 *
 * ESPECIFICACIÓN OFICIAL: 1200 × 400 px, proporción 3:1. Esta proporción se usa
 * en TODO el flujo: uploader, recorte, vista previa, almacenamiento y Landing.
 *
 * - Formatos: JPG / JPEG / PNG / WebP. Nada más.
 * - Peso máximo del archivo original: 3 MB.
 * - Resolución mínima: el recorte 3:1 más ancho que quepa en la imagen debe
 *   tener al menos 1200 px de ancho. Así el resultado 1200×400 nunca se amplía
 *   (siempre es reducción o 1:1) y no queda pixelado.
 * - El usuario elige el encuadre con un recortador de proporción FIJA 3:1
 *   (mover + zoom); la imagen no se deforma nunca.
 */

export const POSTER_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const POSTER_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
export const POSTER_WIDTH = 1200;
export const POSTER_HEIGHT = 400;
export const POSTER_RATIO = POSTER_WIDTH / POSTER_HEIGHT; // 3
export const POSTER_RECOMMENDED_LABEL = "1200 × 400 px";
/** Ancho mínimo (en px de la imagen original) del recorte 3:1: sin ampliación. */
export const POSTER_MIN_SOURCE_WIDTH = POSTER_WIDTH; // 1200

export interface PreparedPoster {
  blob: Blob;
  contentType: "image/webp" | "image/jpeg";
  previewUrl: string;
  /** Región de la imagen original que se conservó (px). */
  cropWidth: number;
  cropHeight: number;
}

export interface PosterSource {
  image: HTMLImageElement;
  /** URL de objeto de la imagen ORIGINAL. El llamador debe revocarla al terminar. */
  objectUrl: string;
  width: number;
  height: number;
}

/**
 * Carga y valida el archivo elegido, listo para pasarlo al recortador.
 * Lanza un `Error` con mensaje claro si el formato, el peso o la resolución
 * no son aceptables.
 */
export async function loadPosterSource(file: File): Promise<PosterSource> {
  if (!(POSTER_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("El formato del poster no es válido. Usa JPG, PNG o WebP.");
  }
  if (file.size > POSTER_MAX_BYTES) {
    throw new Error("El poster supera el tamaño máximo permitido de 3 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  let image: HTMLImageElement;
  try {
    image = await loadImage(objectUrl);
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("El archivo no es una imagen válida.");
  }

  // El recorte 3:1 más ancho que cabe en la imagen.
  const widestCrop = Math.min(width, Math.round(height * POSTER_RATIO));
  if (widestCrop < POSTER_MIN_SOURCE_WIDTH) {
    URL.revokeObjectURL(objectUrl);
    throw new Error(
      `Esta imagen es demasiado pequeña para un poster nítido. Necesitas una imagen equivalente a ${POSTER_RECOMMENDED_LABEL} o más grande (proporción 3:1).`,
    );
  }

  return { image, objectUrl, width, height };
}

/**
 * Dibuja la región elegida de la imagen original en un lienzo de exactamente
 * 1200 × 400 px y devuelve el blob (WebP de alta calidad, fallback JPEG).
 * La región debe respetar la proporción 3:1 y tener al menos
 * `POSTER_MIN_SOURCE_WIDTH` px de ancho (sin ampliación).
 */
export async function renderPosterCrop(
  image: HTMLImageElement,
  crop: { sx: number; sy: number; sw: number; sh: number },
): Promise<PreparedPoster> {
  const sw = Math.round(crop.sw);
  const sh = Math.round(crop.sh);
  if (Math.abs(sw / sh - POSTER_RATIO) > 0.02) {
    throw new Error("El recorte debe mantener la proporción 3:1.");
  }
  if (sw < POSTER_MIN_SOURCE_WIDTH - 2) {
    throw new Error(
      `Has acercado demasiado el zoom: el recorte quedaría por debajo de ${POSTER_RECOMMENDED_LABEL} y se vería pixelado. Aleja el zoom o usa una imagen más grande.`,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No fue posible procesar la imagen en este navegador.");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    Math.max(0, Math.round(crop.sx)),
    Math.max(0, Math.round(crop.sy)),
    sw,
    sh,
    0,
    0,
    POSTER_WIDTH,
    POSTER_HEIGHT,
  );

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
    cropWidth: sw,
    cropHeight: sh,
  };
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
