import JSZip from "jszip";
import { qrSvgString } from "./svg";
import { petPublicUrl } from "@/lib/pets/publicPet";

/**
 * Descarga real de placas QR individuales o en grupo (SVG / PNG / ZIP).
 * Distinto de `printSheet.ts` (que arma una hoja para imprimir/"Guardar como
 * PDF"): aquí se generan archivos de imagen sueltos, descargables uno por uno
 * o empaquetados. Reutiliza `qrSvgString` tal cual — no se modifica el
 * generador de QR.
 */

/** Tamaños físicos ofrecidos (cm). Ver PhysicalSizeCm para el tipo asociado. */
export const QR_PHYSICAL_SIZES_CM = [3, 4, 5] as const;
export type QrPhysicalSizeCm = (typeof QR_PHYSICAL_SIZES_CM)[number];

const PNG_DPI = 300;
const MM_PER_CM = 10;
const MM_PER_INCH = 25.4;

interface QrDownloadItem {
  shortCode: string;
  publicId: string;
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "qr";
}

/** SVG con el tamaño físico ya fijado como atributos `width`/`height` en mm (vectorial: se imprime al tamaño correcto en cualquier programa). */
export function qrSvgFileString(url: string, sizeCm: QrPhysicalSizeCm): string {
  const sizeMm = sizeCm * MM_PER_CM;
  const svg = qrSvgString(url, { border: 2, ecc: "Q" });
  return svg.replace("<svg ", `<svg width="${sizeMm}mm" height="${sizeMm}mm" `);
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No fue posible generar la imagen del QR."));
    };
    img.src = url;
  });
}

/** PNG rasterizado a 300 DPI del tamaño físico elegido. */
export async function qrPngBlob(url: string, sizeCm: QrPhysicalSizeCm): Promise<Blob> {
  const sizeMm = sizeCm * MM_PER_CM;
  const sizePx = Math.round((sizeMm / MM_PER_INCH) * PNG_DPI);
  const svg = qrSvgString(url, { border: 2, ecc: "Q" });
  const img = await loadSvgImage(svg);

  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No fue posible generar la imagen del QR.");
  ctx.imageSmoothingEnabled = false; // bordes nítidos, sin difuminar los módulos del QR
  ctx.drawImage(img, 0, 0, sizePx, sizePx);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No fue posible generar el PNG."));
    }, "image/png");
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadQrSvg(item: QrDownloadItem, origin: string, sizeCm: QrPhysicalSizeCm): Promise<void> {
  const svg = qrSvgFileString(petPublicUrl(item.publicId, origin), sizeCm);
  triggerBlobDownload(new Blob([svg], { type: "image/svg+xml" }), `${safeFileName(item.shortCode)}.svg`);
}

export async function downloadQrPng(item: QrDownloadItem, origin: string, sizeCm: QrPhysicalSizeCm): Promise<void> {
  const blob = await qrPngBlob(petPublicUrl(item.publicId, origin), sizeCm);
  triggerBlobDownload(blob, `${safeFileName(item.shortCode)}.png`);
}

/** ZIP real con un PNG y un SVG por cada placa del grupo (5/10/20). */
export async function downloadQrGroupZip(
  items: QrDownloadItem[],
  origin: string,
  sizeCm: QrPhysicalSizeCm,
  zipName: string,
): Promise<void> {
  const zip = new JSZip();
  for (const item of items) {
    const url = petPublicUrl(item.publicId, origin);
    const name = safeFileName(item.shortCode);
    zip.file(`${name}.svg`, qrSvgFileString(url, sizeCm));
    zip.file(`${name}.png`, await qrPngBlob(url, sizeCm));
  }
  const blob = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(blob, `${safeFileName(zipName)}.zip`);
}
