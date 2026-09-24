// Pruebas de la capa cliente de identificación (sin red ni cámara):
// normalización de códigos (teclado, lector HID con Enter) y lectura de QR/barcode.
//   node --import ./scripts/register-ts.mjs scripts/vet-client.test.mjs
import assert from "node:assert/strict";
import { isPlausibleCode, normalizeCode, parseScanPayload } from "@/lib/vet/identification";
import { vetErrorMessage, isAccessLost } from "@/lib/vet/errors";
import { mapGrant } from "@/lib/vet/access";
import { qrSvgString } from "@/lib/qr/svg";
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from "@zxing/library";

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
}

console.log("== normalizeCode (teclado / lector HID) ==");
for (const [input, expected] of [
  ["HVD-001", "HVD-001"],
  ["hvd-001", "HVD-001"],
  ["  HVD-001  ", "HVD-001"],
  ["HVD-001\n", "HVD-001"],
  ["HVD-001\r\n", "HVD-001"],
  ["\u0002hvd-001\r", "HVD-001"],
  ["hv-l00001", "HV-L00001"],
  ["HV-L00002\n", "HV-L00002"],
  ["abc-999", "ABC-999"],
]) {
  test(`normalizeCode(${JSON.stringify(input)}) = ${expected}`, () => assert.equal(normalizeCode(input), expected));
}
test("no altera un public_id (sin pasar a mayusculas)", () => assert.equal(normalizeCode(" zzvactive002\n"), "zzvactive002"));
test("no inventa ni recorta contenido interno", () => assert.equal(normalizeCode("HVD 001"), "HVD 001"));
test("texto arbitrario no se vuelve un codigo valido", () => {
  for (const bad of ["HVD001", "HV-12", "'; drop table qr_tags;--", "<script>", "HVD-001;", "", "   "]) {
    assert.equal(isPlausibleCode(normalizeCode(bad)), false, bad);
  }
});

console.log("== parseScanPayload ==");
test("QR con URL de placa -> public_id, metodo qr", () => {
  assert.deepEqual(parseScanPayload("https://huellasdevuelta.co/m/pspvyhzam4km", "qr"), { code: "pspvyhzam4km", method: "qr" });
  assert.deepEqual(parseScanPayload("http://localhost:3000/m/pspvyhzam4km/", "qr"), { code: "pspvyhzam4km", method: "qr" });
});
test("QR con URL que no es de placa -> null (nunca se navega ni se usa)", () => {
  assert.equal(parseScanPayload("https://evil.example/login?next=/m/abc", "qr"), null);
  assert.equal(parseScanPayload("https://evil.example/m/../../admin", "qr"), null);
  assert.equal(parseScanPayload("javascript:alert(1)", "qr"), null);
});
test("barcode con short_code -> metodo barcode, mayusculas", () => {
  assert.deepEqual(parseScanPayload("hvd-001\n", "barcode"), { code: "HVD-001", method: "barcode" });
  assert.deepEqual(parseScanPayload("HV-L00001", "barcode"), { code: "HV-L00001", method: "barcode" });
});
test("codigo invalido -> null", () => {
  for (const bad of ["", "hola mundo", "12345", "HVD-1", "x".repeat(400)]) assert.equal(parseScanPayload(bad, "barcode"), null, bad.slice(0, 10));
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
    assert.deepEqual(parseScanPayload(text, "qr"), { code: id, method: "qr" });
  }
});

console.log(`\n${passed} pruebas OK${process.exitCode ? " (HAY FALLAS)" : ""}`);
