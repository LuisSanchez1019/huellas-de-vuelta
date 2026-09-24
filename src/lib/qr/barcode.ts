/**
 * Código de barras Code 128 (subconjunto B) para `qr_tags.short_code`.
 *
 * El código de barras NO se guarda en BD: se DERIVA siempre del `short_code`
 * (misma identificación que el QR; el NFC futuro también resolvería al mismo
 * tag). Solo codifica el identificador — nunca nombre, teléfono ni datos
 * médicos. La salida es determinista: mismo texto y opciones, mismo SVG.
 *
 * Sin dependencias ni APIs de DOM: sirve igual en navegador, servidor o en un
 * futuro cliente Capacitor. La prueba de ida y vuelta (generar y decodificar con
 * ZXing) está en `scripts/barcode-roundtrip.test.mjs`.
 */

/** Anchos (barra, espacio, barra, ...) de cada símbolo 0..106; 106 = STOP (7 elementos). */
const PATTERNS: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;

/** Formato de los short_code reales de `qr_tags` (mismo CHECK que la BD). */
const SHORT_CODE_RE = /^(?:[A-Z]{3}-[0-9]{3}|HV-L?[0-9]{4,6})$/;

export function isValidShortCode(text: string): boolean {
  return SHORT_CODE_RE.test(text);
}

/** Code 128B admite ASCII imprimible 32..126. */
export function isCode128BEncodable(text: string): boolean {
  if (text.length === 0) return false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 32 || c > 126) return false;
  }
  return true;
}

/** Valores de símbolo (start, datos, checksum, stop) de un texto Code 128B. */
export function code128BSymbols(text: string): number[] {
  if (!isCode128BEncodable(text)) {
    throw new Error("Texto no codificable en Code 128B (solo ASCII imprimible).");
  }
  const symbols = [START_B];
  let sum = START_B;
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i) - 32;
    symbols.push(value);
    sum += value * (i + 1);
  }
  symbols.push(sum % 103, STOP);
  return symbols;
}

/** Secuencia de anchos en módulos: barra, espacio, barra, ... (empieza y termina en barra). */
export function code128BWidths(text: string): number[] {
  const widths: number[] = [];
  for (const symbol of code128BSymbols(text)) {
    for (const ch of PATTERNS[symbol]) widths.push(Number(ch));
  }
  return widths;
}

export interface BarcodeSvgOptions {
  /** Ancho de un módulo en unidades del SVG. Por defecto 2. */
  moduleWidth?: number;
  /** Alto de las barras. Por defecto 60. */
  height?: number;
  /** Zona de silencio a cada lado, en módulos (mínimo Code 128: 10). Por defecto 10. */
  quietModules?: number;
  color?: string;
  /** Color de fondo; `null` = transparente. Por defecto blanco (mejor para impresión y lectores). */
  background?: string | null;
}

const COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]{3,20}$/;

/**
 * SVG del código de barras de un texto Code 128B. Para placas usar
 * `barcodeSvgForShortCode`, que además exige el formato real de `short_code`.
 */
export function barcodeSvg(text: string, options: BarcodeSvgOptions = {}): string {
  const moduleWidth = options.moduleWidth ?? 2;
  const height = options.height ?? 60;
  const quiet = options.quietModules ?? 10;
  const color = options.color ?? "#000000";
  const background = options.background === undefined ? "#ffffff" : options.background;
  if (!(moduleWidth > 0) || !(height > 0) || quiet < 10) {
    throw new Error("Opciones de código de barras no válidas (zona de silencio mínima: 10 módulos).");
  }
  if (!COLOR_RE.test(color) || (background !== null && !COLOR_RE.test(background))) {
    throw new Error("Color no válido.");
  }

  const widths = code128BWidths(text);
  const totalModules = widths.reduce((a, b) => a + b, 0) + quiet * 2;
  const width = totalModules * moduleWidth;

  let x = quiet;
  let path = "";
  widths.forEach((w, index) => {
    if (index % 2 === 0) path += `M${x * moduleWidth} 0h${w * moduleWidth}v${height}h-${w * moduleWidth}z`;
    x += w;
  });

  const label = text.replace(/[&<>"']/g, "");
  const bg = background === null ? "" : `<rect width="${width}" height="${height}" fill="${background}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
    `role="img" aria-label="Código de barras ${label}" shape-rendering="crispEdges">` +
    `${bg}<path d="${path}" fill="${color}"/></svg>`
  );
}

/** SVG del código de barras de una placa: valida el formato real del short_code. */
export function barcodeSvgForShortCode(shortCode: string, options: BarcodeSvgOptions = {}): string {
  if (!isValidShortCode(shortCode)) {
    throw new Error("El short_code no tiene el formato de una placa.");
  }
  return barcodeSvg(shortCode, options);
}
