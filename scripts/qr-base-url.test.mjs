// Pruebas del dominio oficial del QR físico: nunca depende del navegador y falla cerrado.
//   node --experimental-transform-types --import ./scripts/register-ts.mjs scripts/qr-base-url.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from "@zxing/library";
import { QrBaseUrlError, buildQrPublicUrl, qrPublicUrl, resolveQrBaseUrl } from "@/lib/qr/qrBaseUrl";
import { qrSvgFileString } from "@/lib/qr/download";
import { buildQrPrintDocument } from "@/lib/qr/printSheet";

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
}
const throwsCode = (raw, code) => assert.throws(() => resolveQrBaseUrl(raw), (e) => e instanceof QrBaseUrlError && e.code === code, `${raw} -> ${code}`);

console.log("== dominio oficial del QR ==");
await test("dominio https válido: se normaliza a su origen", () => {
  assert.equal(resolveQrBaseUrl("https://huellasdevuelta.com"), "https://huellasdevuelta.com");
  assert.equal(resolveQrBaseUrl("  https://www.huellasdevuelta.com/  "), "https://www.huellasdevuelta.com");
  assert.equal(resolveQrBaseUrl("https://huellas.vercel.app"), "https://huellas.vercel.app");
});
await test("configuración ausente o vacía: se rechaza (sin caer a otro dominio)", () => {
  throwsCode(undefined, "MISSING");
  throwsCode(null, "MISSING");
  throwsCode("", "MISSING");
  throwsCode("   ", "MISSING");
});
await test("URL inválida", () => {
  throwsCode("huellasdevuelta.com", "INVALID");
  throwsCode("https://", "INVALID");
  throwsCode("no es una url", "INVALID");
});
await test("http y otros protocolos: se rechazan", () => {
  throwsCode("http://huellasdevuelta.com", "INSECURE");
  throwsCode("ftp://huellasdevuelta.com", "INSECURE");
  throwsCode("javascript:alert(1)", "INSECURE");
});
await test("localhost, IP, red privada y nombres internos: no son dominios públicos", () => {
  for (const host of ["localhost", "app.localhost", "127.0.0.1", "192.168.1.10", "10.0.0.5", "[::1]", "intranet", "servidor.local", "8.8.8.8"]) {
    throwsCode(`https://${host}`, "NOT_PUBLIC");
  }
});
await test("solo el dominio: sin ruta, parámetros, hash ni credenciales", () => {
  throwsCode("https://huellasdevuelta.com/app", "SHAPE");
  throwsCode("https://huellasdevuelta.com/?x=1", "SHAPE");
  throwsCode("https://huellasdevuelta.com/#a", "SHAPE");
  throwsCode("https://user:pass@huellasdevuelta.com", "SHAPE");
});
await test("la URL del QR es <dominio>/m/<public_id> y solo acepta ids con forma de public_id", () => {
  assert.equal(buildQrPublicUrl("https://huellasdevuelta.com", "pw8bpgy3a62t"), "https://huellasdevuelta.com/m/pw8bpgy3a62t");
  for (const bad of ["", "abc", "../admin", "pw8bpgy3a62t/../x", "pw8bpgy3a62t?x=1", "ZZQ-901", "a".repeat(40)]) {
    assert.throws(() => buildQrPublicUrl("https://huellasdevuelta.com", bad), QrBaseUrlError, bad);
  }
});

console.log("== generación real con NEXT_PUBLIC_SITE_URL (SVG -> píxeles -> lector ZXing) ==");
/** Rasteriza el SVG real del generador y lo decodifica con un lector independiente del encoder. */
function decodeQrSvg(svg, scale = 8) {
  const dim = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)[1]);
  const px = dim * scale;
  const lum = new Uint8ClampedArray(px * px).fill(255);
  for (const [, mx, my] of svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) {
    for (let y = Number(my) * scale; y < (Number(my) + 1) * scale; y++)
      for (let x = Number(mx) * scale; x < (Number(mx) + 1) * scale; x++) lum[y * px + x] = 0;
  }
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]], [DecodeHintType.TRY_HARDER, true]]);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, px, px)))).getText();
}
const OFFICIAL = "https://qr.huellas-de-vuelta.example";
await test("sin NEXT_PUBLIC_SITE_URL no se genera SVG, descarga ni hoja de impresión", () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.throws(() => qrPublicUrl("pspvyhzam4km"), QrBaseUrlError);
  assert.throws(() => buildQrPrintDocument([{ shortCode: "HV-L00001", publicId: "pspvyhzam4km" }], "lote"), QrBaseUrlError);
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  assert.throws(() => buildQrPrintDocument([{ shortCode: "HV-L00001", publicId: "pspvyhzam4km" }], "lote"), QrBaseUrlError);
});
await test("con NEXT_PUBLIC_SITE_URL válido: el QR descargable decodifica EXACTAMENTE <dominio>/m/<public_id>", () => {
  process.env.NEXT_PUBLIC_SITE_URL = OFFICIAL;
  for (const id of ["pspvyhzam4km", "27k44yf3qja3"]) {
    assert.equal(decodeQrSvg(qrSvgFileString(qrPublicUrl(id), 3)), `${OFFICIAL}/m/${id}`);
  }
});
await test("la hoja de impresión: cada celda decodifica su URL oficial (nunca el origen del navegador)", () => {
  process.env.NEXT_PUBLIC_SITE_URL = OFFICIAL;
  const html = buildQrPrintDocument([{ shortCode: "HV-L00001", publicId: "pspvyhzam4km" }, { shortCode: "HV-L00002", publicId: "27k44yf3qja3" }], "lote");
  const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  assert.equal(svgs.length, 2);
  assert.deepEqual(svgs.map((svg) => decodeQrSvg(svg)), [`${OFFICIAL}/m/pspvyhzam4km`, `${OFFICIAL}/m/27k44yf3qja3`]);
});

console.log("== ningún QR se genera con el origen del navegador ==");
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out); else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
await test("los archivos que generan QR físicos no usan window.location.origin ni petPublicUrl", () => {
  const root = fileURLToPath(new URL("../src", import.meta.url));
  const files = walk(root).filter((f) => /\/(qr|proveedores)\//.test(f.split(sep).join("/")));
  assert.ok(files.length >= 5, "se esperaban los archivos del dominio QR");
  for (const f of files) {
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(src, /window\.location\.origin/, f);
    assert.doesNotMatch(src, /petPublicUrl/, f);
  }
});

console.log(`\n${passed} pruebas OK${process.exitCode ? " (HAY FALLAS)" : ""}`);
