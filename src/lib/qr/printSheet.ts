import { qrSvgString } from "./svg";
import { petPublicUrl } from "@/lib/pets/publicPet";

/**
 * Documento imprimible de un lote / rango de placas QR.
 *
 * Genera una hoja HTML con una cuadrícula de celdas (una por placa): QR +
 * código corto + identificación "Huellas de Vuelta". Se abre en una ventana
 * nueva y se manda a imprimir; desde el diálogo de impresión del navegador se
 * puede "Guardar como PDF". No usa librerías de PDF.
 *
 * Cada celda deriva el QR EXACTAMENTE del `publicId` de su placa, así que no
 * hay forma de que dos celdas apunten al mismo destino ni que un QR no
 * corresponda a su código.
 *
 * `layout` deja preparado el terreno para adaptar el diseño a distintos tipos
 * de placa/etiqueta más adelante (tamaño de celda y columnas).
 */
export interface QrPrintItem {
  shortCode: string;
  publicId: string;
}

export interface QrPrintLayout {
  columns: number;
  /** Lado del QR en mm. */
  qrSizeMm: number;
}

const DEFAULT_LAYOUT: QrPrintLayout = { columns: 4, qrSizeMm: 32 };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildQrPrintDocument(
  items: QrPrintItem[],
  origin: string,
  batchLabel: string,
  layout: QrPrintLayout = DEFAULT_LAYOUT,
): string {
  const cells = items
    .map((item) => {
      const url = petPublicUrl(item.publicId, origin);
      const svg = qrSvgString(url, { border: 2, ecc: "Q" });
      return `<div class="cell">
        <div class="qr">${svg}</div>
        <div class="code">${escapeHtml(item.shortCode)}</div>
        <div class="brand">Huellas de Vuelta</div>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Placas QR · ${escapeHtml(batchLabel)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Lexend", system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #17223f; }
  .head { padding: 10mm 12mm 0; }
  .head h1 { font-size: 14pt; margin: 0 0 2mm; }
  .head p { font-size: 9pt; margin: 0; color: #48566a; }
  .grid {
    display: grid;
    grid-template-columns: repeat(${layout.columns}, 1fr);
    gap: 6mm;
    padding: 8mm 12mm 12mm;
  }
  .cell {
    border: 0.3mm solid #dde6ec;
    border-radius: 2mm;
    padding: 4mm 3mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2mm;
    page-break-inside: avoid;
  }
  .qr { width: ${layout.qrSizeMm}mm; height: ${layout.qrSizeMm}mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .code { font-size: 10pt; font-weight: 700; letter-spacing: 0.04em; }
  .brand { font-size: 7pt; color: #48566a; text-transform: uppercase; letter-spacing: 0.08em; }
  @page { margin: 10mm; }
  @media print { .head { padding-top: 0; } }
</style>
</head>
<body>
  <div class="head">
    <h1>Placas QR — ${escapeHtml(batchLabel)}</h1>
    <p>${items.length} unidad${items.length === 1 ? "" : "es"} · cada QR abre el perfil público de la mascota asignada. El código no contiene datos personales.</p>
  </div>
  <div class="grid">${cells}</div>
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 250); });</script>
</body>
</html>`;
}

/**
 * Abre el documento imprimible en una pestaña nueva mediante un Blob URL
 * (sin `document.write`). El documento se auto-manda a imprimir al cargar.
 */
export function openQrPrintSheet(
  items: QrPrintItem[],
  origin: string,
  batchLabel: string,
  layout?: QrPrintLayout,
): boolean {
  const html = buildQrPrintDocument(items, origin, batchLabel, layout);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
