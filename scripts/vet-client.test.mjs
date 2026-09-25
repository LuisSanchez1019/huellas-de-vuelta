// Pruebas de la capa cliente de identificación (sin red ni cámara): la placa se identifica
// SOLO por QR (NFC a futuro); no hay código de barras y el short_code no identifica.
//   node --experimental-transform-types --import ./scripts/register-ts.mjs scripts/vet-client.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPlausiblePublicId, isShortCode, normalizeCode, parseScanPayload } from "@/lib/vet/identification";
import { vetErrorMessage, isAccessLost } from "@/lib/vet/errors";
import { mapGrant } from "@/lib/vet/access";
import { qrSvgString } from "@/lib/qr/svg";
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from "@zxing/library";

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
}
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

console.log("== normalizeCode (lector de QR / teclado) ==");
for (const [input, expected] of [
  ["pspvyhzam4km", "pspvyhzam4km"],
  ["  pspvyhzam4km  ", "pspvyhzam4km"],
  ["pspvyhzam4km\n", "pspvyhzam4km"],
  ["pspvyhzam4km\r\n", "pspvyhzam4km"],
  ["\u0002pspvyhzam4km\r", "pspvyhzam4km"],
]) {
  test(`normalizeCode(${JSON.stringify(input)}) = ${expected}`, () => assert.equal(normalizeCode(input), expected));
}
test("no altera mayusculas ni contenido interno (ya no hay codigos cortos que normalizar)", () => {
  assert.equal(normalizeCode(" ZzVactive002\n"), "ZzVactive002");
  assert.equal(normalizeCode("HVD 001"), "HVD 001");
});
test("texto arbitrario no tiene forma de identificador", () => {
  for (const bad of ["HVD001", "HV-12", "'; drop table qr_tags;--", "<script>", "abc-def", "", "   "]) {
    assert.equal(isPlausiblePublicId(normalizeCode(bad)), false, bad);
  }
});

console.log("== parseScanPayload (solo QR / token) ==");
test("QR con URL de placa -> public_id, metodo qr", () => {
  assert.deepEqual(parseScanPayload("https://huellasdevuelta.co/m/pspvyhzam4km"), { code: "pspvyhzam4km", method: "qr" });
  assert.deepEqual(parseScanPayload("http://localhost:3000/m/pspvyhzam4km/"), { code: "pspvyhzam4km", method: "qr" });
});
test("token suelto (lector configurado sin URL) -> qr", () => {
  assert.deepEqual(parseScanPayload("pspvyhzam4km\n"), { code: "pspvyhzam4km", method: "qr" });
});
test("QR con URL que no es de placa -> null (nunca se navega ni se usa)", () => {
  assert.equal(parseScanPayload("https://evil.example/login?next=/m/abc"), null);
  assert.equal(parseScanPayload("https://evil.example/m/../../admin"), null);
  assert.equal(parseScanPayload("javascript:alert(1)"), null);
});
test("el short_code NO identifica: se rechaza en cualquier formato", () => {
  for (const code of ["HVD-001", "hvd-001\n", "ABC-999", "HV-L00001", "HV-000123"]) {
    assert.equal(parseScanPayload(code), null, code);
    assert.equal(isShortCode(normalizeCode(code)), true, code);
  }
});
test("codigo invalido -> null", () => {
  for (const bad of ["", "hola mundo", "12345", "HVD-1", "x".repeat(400)]) assert.equal(parseScanPayload(bad), null, bad.slice(0, 10));
});

console.log("== el codigo de barras ya no es parte del producto ==");
test("identification.ts: metodos solo qr | nfc", () => {
  const src = read("src/lib/vet/identification.ts");
  assert.match(src, /IdentificationMethod = "qr" \| "nfc"/);
  assert.doesNotMatch(src, /"barcode"|"manual"/);
});
test("escaner: solo QR (sin CODE_128 ni formato barcode)", () => {
  const src = read("src/lib/scanner/scanner.ts");
  assert.doesNotMatch(src, /CODE_128|code_128|"barcode"/);
  assert.match(src, /QR_CODE/);
});
test("UI veterinaria: sin boton de codigo de barras ni entrada manual de codigo corto", () => {
  for (const f of ["src/components/vet/IdentifyPanel.tsx", "src/components/vet/CameraScanner.tsx", "src/components/vet/IdentifiedPetPanel.tsx"]) {
    const src = read(f);
    assert.doesNotMatch(src, /c[oó]digo de barras|barcode|Introducir c[oó]digo|ABC-001/i, f);
  }
});
test("el generador de codigo de barras fue eliminado del producto", () => {
  assert.throws(() => read("src/lib/qr/barcode.ts"), /ENOENT/);
});
test("las RPC del servidor solo aceptan qr y nfc (migracion vigente)", () => {
  const sql = read("supabase/migrations/20260928000100_vet_identification_qr_nfc_only.sql");
  assert.equal((sql.match(/p_method not in \('qr', 'nfc'\)/g) ?? []).length, 3);
  assert.doesNotMatch(sql, /p_method not in \([^)]*barcode/);
  assert.match(sql, /NO identifica para veterinaria/);
});

console.log("== errores y mapeo ==");
test("codigos de la BD -> mensajes genericos (no revelan por que)", () => {
  assert.match(vetErrorMessage({ message: "ACCESS_DENIED" }), /acceso vigente/i);
  assert.match(vetErrorMessage({ message: "PET_NOT_FOUND" }), /No encontramos este identificador/);
  assert.match(vetErrorMessage({ message: "algo raro con SQL interno" }), /No fue posible/);
  assert.equal(isAccessLost({ message: "ACCESS_DENIED" }), true);
  assert.equal(isAccessLost({ message: "PERMISSION_DENIED" }), false);
});
test("mapGrant conserva estado efectivo derivado", () => {
  const g = mapGrant({ id: "1", status: "active", effective_status: "expired", requested_permissions: ["can_read_medical"], granted_permissions: ["can_read_medical"], requested_duration: "1h", granted_duration: "1h", created_at: "x", expires_at: "y" });
  assert.equal(g.effectiveStatus, "expired");
  assert.equal(g.status, "active");
});

console.log("== QR de la placa: generar -> decodificar (ZXing) -> parseScanPayload ==");
function decodeQrSvg(svg, scale = 6) {
  const dim = Number(/viewBox="0 0 (\d+) /.exec(svg)[1]);
  const px = dim * scale;
  const lum = new Uint8ClampedArray(px * px).fill(255);
  for (const [, mx, my] of svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) {
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) lum[(Number(my) * scale + y) * px + Number(mx) * scale + x] = 0;
  }
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]]]);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, px, px)))).getText();
}
test("el QR de una placa se decodifica exactamente y se resuelve al public_id", () => {
  for (const id of ["pspvyhzam4km", "27k44yf3qja3", "zzvactive002"]) {
    const url = `https://huellasdevuelta.co/m/${id}`;
    const text = decodeQrSvg(qrSvgString(url));
    assert.equal(text, url);
    assert.deepEqual(parseScanPayload(text), { code: id, method: "qr" });
  }
});

console.log(`\n${passed} pruebas OK${process.exitCode ? " (HAY FALLAS)" : ""}`);
