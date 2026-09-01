import { Ecc, QrCode } from "./qrcodegen";

export type QrEccLevel = "M" | "Q" | "H";

/**
 * Genera un QR como cadena SVG (vectorial, no se degrada al redimensionar).
 * Sirve tanto para render inline como para el Blob de descarga.
 */
export function qrSvgString(
  text: string,
  opts: { border?: number; ecc?: QrEccLevel; dark?: string; light?: string } = {},
): string {
  const border = Math.max(0, opts.border ?? 4);
  const dark = opts.dark ?? "#000000";
  const light = opts.light ?? "#ffffff";
  const eccByLevel: Record<QrEccLevel, Ecc> = { M: Ecc.MEDIUM, Q: Ecc.QUARTILE, H: Ecc.HIGH };

  const qr = QrCode.encodeText(text, eccByLevel[opts.ecc ?? "Q"]);
  const dim = qr.size + border * 2;

  let path = "";
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) {
        path += `${path ? " " : ""}M${x + border},${y + border}h1v1h-1z`;
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">`,
    `<rect width="${dim}" height="${dim}" fill="${light}"/>`,
    `<path d="${path}" fill="${dark}"/>`,
    `</svg>`,
  ].join("");
}
