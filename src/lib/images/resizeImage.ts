export const MAX_IMAGE_DIMENSION = 1600;

export interface ResizedImage {
  blob: Blob;
  contentType: "image/webp" | "image/jpeg";
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Redimensiona una imagen en el navegador para almacenarla en Storage con un
 * tamaño razonable. Escala para que el lado mayor no supere
 * `MAX_IMAGE_DIMENSION` px (no amplía imágenes más pequeñas) y la exporta como
 * WebP; si el navegador no soporta WebP en `toBlob`, cae a JPEG.
 *
 * No sube nada: solo transforma el archivo y devuelve un blob listo para subir
 * más una URL de objeto para la vista previa (recuerda revocarla al descartarla).
 */
export async function resizeImage(file: File): Promise<ResizedImage> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(bitmapUrl);

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("No fue posible procesar la imagen en este navegador.");
    }
    context.drawImage(image, 0, 0, width, height);

    let contentType: ResizedImage["contentType"] = "image/webp";
    let blob = await canvasToBlob(canvas, contentType, 0.85);
    if (!blob) {
      contentType = "image/jpeg";
      blob = await canvasToBlob(canvas, contentType, 0.85);
    }
    if (!blob) {
      throw new Error("No fue posible procesar la imagen.");
    }

    return { blob, contentType, previewUrl: URL.createObjectURL(blob), width, height };
  } finally {
    URL.revokeObjectURL(bitmapUrl);
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
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
