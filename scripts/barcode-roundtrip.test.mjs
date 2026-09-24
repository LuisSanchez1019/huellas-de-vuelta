// Prueba de ida y vuelta del código de barras: short_code -> SVG -> pixeles -> decodificador ZXing
// (independiente del encoder) -> debe devolver EXACTAMENTE el short_code.
//
//   node scripts/barcode-roundtrip.test.mjs
//
// Node >= 22.18 ejecuta barcode.ts directamente (sin compilar).
import assert from "node:assert/strict";
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import { barcodeSvg, barcodeSvgForShortCode, code128BSymbols, isCode128BEncodable } from "../src/lib/qr/barcode.ts";

/** Rasteriza el SVG generado (fondo + un <path> de barras) a una imagen de luminancia. */
function rasterize(svg, scale = 1, rows = 40) {
  const size = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  assert.ok(size, "viewBox presente");
  const w = Number(size[1]);
  const h = Number(size[2]);
  const pxW = w * scale;
  const lum = new Uint8ClampedArray(pxW * rows).fill(255);
  const bars = [...svg.matchAll(/M(\d+) 0h(\d+)v(\d+)h-(\d+)z/g)];
  assert.ok(bars.length > 0, "barras presentes");
  for (const [, x, bw] of bars) {
    for (let y = 0; y < rows; y++) {
      for (let px = Number(x) * scale; px < (Number(x) + Number(bw)) * scale; px++) lum[y * pxW + px] = 0;
    }
  }
  assert.ok(h > 0);
  return { lum, width: pxW, height: rows };
}

function decode(svg, scale = 1) {
  const { lum, width, height } = rasterize(svg, scale);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, width, height)));
  const result = reader.decode(bitmap);
  return { text: result.getText(), format: result.getBarcodeFormat() };
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    console.error(`  FAIL  ${name}\n        ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}

console.log("== Code 128B: short_code -> SVG -> decodificar ==");
for (const code of ["HVD-001", "ABC-999", "HV-L00001", "HV-L00002", "ZZV-002", "HV-000123", "AAA-000"]) {
  test(`ida y vuelta exacta: ${code}`, () => {
    const svg = barcodeSvgForShortCode(code);
    const out = decode(svg);
    assert.equal(out.text, code);
    assert.equal(out.format, BarcodeFormat.CODE_128);
  });
}

test("ida y vuelta con modulo de 1 px (resolucion minima de impresora/pantalla)", () => {
  assert.equal(decode(barcodeSvgForShortCode("HVD-001", { moduleWidth: 1 })).text, "HVD-001");
});
test("ida y vuelta con modulo de 3 y rasterizado a doble escala", () => {
  assert.equal(decode(barcodeSvgForShortCode("HV-L00001", { moduleWidth: 3 }), 2).text, "HV-L00001");
});
test("el barcode NO cambia el valor: distinto codigo -> distinto resultado", () => {
  assert.notEqual(decode(barcodeSvgForShortCode("HVD-001")).text, decode(barcodeSvgForShortCode("HVD-002")).text);
});
test("determinista: misma entrada -> mismo SVG byte a byte", () => {
  assert.equal(barcodeSvgForShortCode("ABC-999"), barcodeSvgForShortCode("ABC-999"));
});
test("simbolos: start B (104) + datos + checksum + stop (106)", () => {
  const s = code128BSymbols("HVD-001");
  assert.equal(s[0], 104);
  assert.equal(s.at(-1), 106);
  assert.equal(s.length, "HVD-001".length + 3);
  let sum = 104;
  "HVD-001".split("").forEach((c, i) => (sum += (c.charCodeAt(0) - 32) * (i + 1)));
  assert.equal(s.at(-2), sum % 103);
});
test("no codifica nada mas que el identificador (el SVG no contiene el texto fuera del aria-label)", () => {
  const svg = barcodeSvgForShortCode("HVD-001");
  assert.ok(!/<text|<script|href=/i.test(svg));
});

console.log("== Entradas invalidas ==");
for (const bad of ["", "HVDé001", "HVD\n001", "HVD\t001", "HVD\u{1F436}", "\u0000", "HVD-001\u007f"]) {
  test(`Code128B rechaza ${JSON.stringify(bad)}`, () => {
    assert.equal(isCode128BEncodable(bad), false);
    assert.throws(() => barcodeSvg(bad));
  });
}
for (const bad of ["hvd-001", "HVD001", "HVD-0001", "HV-12", "ABCD-001", "HVD-001 ", "<svg>", "A;B-001"]) {
  test(`short_code invalido rechazado por el generador de placas: ${JSON.stringify(bad)}`, () => {
    assert.throws(() => barcodeSvgForShortCode(bad));
  });
}
test("opciones inseguras rechazadas (zona de silencio < 10, color inyectado)", () => {
  assert.throws(() => barcodeSvg("HVD-001", { quietModules: 2 }));
  assert.throws(() => barcodeSvg("HVD-001", { color: '"/><script>' }));
});
test("con fondo transparente no hay rect de fondo", () => {
  assert.ok(!/<rect/.test(barcodeSvgForShortCode("HVD-001", { background: null })));
});

console.log(`\n${passed} pruebas OK${process.exitCode ? " (HAY FALLAS)" : ""}`);
