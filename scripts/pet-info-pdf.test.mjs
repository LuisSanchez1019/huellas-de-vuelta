// Pruebas del PDF "Información de mi mascota" (sin red ni BD): contenido, maquetación
// con mucho texto, ausencia de datos opcionales y nombre de archivo seguro.
//   node --experimental-transform-types --import ./scripts/register-ts.mjs scripts/pet-info-pdf.test.mjs
import assert from "node:assert/strict";
import { buildPetInfoPdf, petInfoPdfFileName } from "@/lib/pdf/petInfo";

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
}

const consultation = (i, extra = {}) => ({
  id: `c${i}`, consultedAt: "2026-09-23T15:00:00Z", orgName: "Clínica Demo", vetName: "Dra. Demo", ownOrg: false,
  reason: `Motivo ${i}`, weightKg: 12.5, temperatureC: 38.5, heartRate: 90, respiratoryRate: 20,
  symptoms: "síntomas", physicalExam: "examen", diagnosis: `Diagnóstico ${i}`, treatment: `Tratamiento ${i}`,
  recommendations: "reposo", finalObservations: null, urgency: "routine", followUpDate: null,
  medications: [{ name: `Med ${i}`, dose: 250, doseUnit: "mg", frequency: "cada 12 h", route: "oral", durationDays: 7, instructions: "con comida", startDate: null, endDate: null, notes: null }],
  addenda: [{ id: `a${i}`, createdAt: "2026-09-24T10:00:00Z", body: `Corrección ${i}`, orgName: "Clínica Demo", vetName: "Dra. Demo" }],
  ...extra,
});

const base = {
  generatedAt: "2026-09-24T12:00:00Z", generatedBy: "Ana Demo", logo: null, photo: null,
  pet: { name: "Max", speciesLabel: "Perro", breed: "Criollo", sexLabel: "Macho", birthDateText: "23 de septiembre de 2021", ageText: "5 años", colors: null, statusLabel: "En casa", description: "Juguetón", registeredAt: "2026-01-10T10:00:00Z" },
  plate: { code: "ABC-001", statusLabel: "Activa", publicUrl: null },
  medical: { flags: ["Alergias"], notes: "Nota", items: [{ kindLabel: "Alergia", label: "Penicilina", detail: null, sourceLabel: "Aportada por el propietario" }] },
  vaccinations: [
    { name: "Rabia", applicationDate: "2026-03-10", nextDoseDate: "2027-03-10", lotNumber: "L-778", veterinaryName: "Vet Central", notes: null },
    { name: "Parvovirus", applicationDate: "2026-05-02", nextDoseDate: null, lotNumber: null, veterinaryName: null, notes: "sin reacción" },
  ],
  consultations: [consultation(1), consultation(2)],
};
const raw = (doc) => Buffer.from(doc.output("arraybuffer")).toString("latin1");

test("contiene título, mascota, placa, médica, consultas, medicamentos y adendas", () => {
  const t = raw(buildPetInfoPdf(base));
  assert.ok(t.startsWith("%PDF-"));
  for (const s of ["Max", "Criollo", "ABC-001", "Penicilina", "Diagnóstico 1", "Tratamiento 2", "Med 1", "Corrección 2", "Clínica Demo", "Dra. Demo"]) assert.ok(t.includes(s), s);
  assert.ok(t.includes("Información de mi mascota"));
  assert.ok(/Generado el/.test(t));
});
test("incluye fecha de nacimiento, edad calculada y vacunación", () => {
  const t = raw(buildPetInfoPdf(base));
  for (const s of ["FECHA DE NACIMIENTO", "23 de septiembre de 2021", "5 a", "VACUNACI", "Rabia", "Parvovirus", "L-778", "Vet Central"]) assert.ok(t.includes(s), s);
});
test("sin vacunas ni fecha de nacimiento: genera y avisa", () => {
  const t = raw(buildPetInfoPdf({ ...base, vaccinations: [], pet: { ...base.pet, birthDateText: null, ageText: null } }));
  assert.ok(t.includes("No hay vacunas registradas"));
  assert.ok(!t.includes("FECHA DE NACIMIENTO"));
});
test("paginación consistente y varias páginas con 60 consultas largas", () => {
  const long = Array.from({ length: 60 }, (_, i) => consultation(i, { symptoms: "texto largo ".repeat(80), diagnosis: "X".repeat(500) }));
  const doc = buildPetInfoPdf({ ...base, consultations: long });
  const n = doc.getNumberOfPages();
  assert.ok(n > 10, `páginas: ${n}`);
  assert.ok(raw(doc).includes(`de ${n}`));
});
test("palabras sin espacios se parten y no desbordan el ancho útil", () => {
  const doc = buildPetInfoPdf(base);
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize("Y".repeat(500), 100);
  assert.ok(Math.max(...lines.map((l) => doc.getTextWidth(l))) <= 100);
});
test("sin foto/logo/placa/médica/consultas: genera y avisa cada ausencia", () => {
  const t = raw(buildPetInfoPdf({ ...base, plate: null, medical: null, consultations: [] }));
  assert.ok(t.includes("Esta mascota no tiene una placa"));
  assert.ok(t.includes("No hay informaci"));
  assert.ok(t.includes("Todav"));
});
test("no menciona almacenamiento: declara que no se conserva copia", () => {
  assert.ok(raw(buildPetInfoPdf(base)).includes("no conserva una copia"));
});
test("nombre de archivo seguro", () => {
  assert.equal(petInfoPdfFileName("Máx/../x"), "informacion-Max-x.pdf");
  assert.equal(petInfoPdfFileName("///"), "informacion-mascota.pdf");
});

console.log(`\n${passed} pruebas OK${process.exitCode ? " (HAY FALLAS)" : ""}`);
