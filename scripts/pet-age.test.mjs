// Pruebas de fecha de nacimiento, edad calculada, cumpleaños y textos (sin red ni BD).
//   node --experimental-transform-types --import ./scripts/register-ts.mjs scripts/pet-age.test.mjs
import assert from "node:assert/strict";
import {
  HUMAN_AGE_NOTE, birthdayAge, birthdayCopy, calcAge, formatAge, formatBirthDate,
  parseDateOnly, todayLocal, validateBirthDate,
} from "@/lib/pets/age";

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
}

test("edad en años completos (antes y después del cumpleaños)", () => {
  assert.equal(formatAge("2021-09-23", "2026-09-23"), "5 años");
  assert.equal(formatAge("2021-09-23", "2026-09-22"), "4 años");
  assert.equal(formatAge("2025-09-23", "2026-09-23"), "1 año");
});
test("menor de 1 año se muestra en meses; menor de 1 mes no dice 0 meses", () => {
  assert.equal(formatAge("2026-01-23", "2026-09-23"), "8 meses");
  assert.equal(formatAge("2026-08-23", "2026-09-23"), "1 mes");
  assert.equal(formatAge("2026-09-10", "2026-09-23"), "Menos de 1 mes");
  assert.equal(formatAge("2025-10-01", "2026-09-23"), "11 meses");
});
test("la edad cambia con la fecha (no es un valor fijo)", () => {
  assert.equal(formatAge("2020-06-15", "2026-06-14"), "5 años");
  assert.equal(formatAge("2020-06-15", "2026-06-15"), "6 años");
  assert.equal(formatAge("2020-06-15", "2030-06-15"), "10 años");
});
test("fecha futura o inválida: sin edad y con error de validación", () => {
  assert.equal(calcAge("2027-01-01", "2026-09-23"), null);
  assert.equal(formatAge("2026-02-30", "2026-09-23"), null);
  assert.equal(formatAge("basura", "2026-09-23"), null);
  assert.equal(formatAge(null, "2026-09-23"), null);
  assert.equal(parseDateOnly("2026-13-01"), null);
  assert.equal(validateBirthDate("2027-01-01", "2026-09-23"), "La fecha de nacimiento no puede ser futura.");
  assert.equal(validateBirthDate("2026-02-30", "2026-09-23"), "La fecha de nacimiento no es válida.");
  assert.ok(validateBirthDate("1970-01-01", "2026-09-23"));
  assert.equal(validateBirthDate("", "2026-09-23"), null);
  assert.equal(validateBirthDate("2026-09-23", "2026-09-23"), null);
});
test("formato largo en español sin desfase de zona horaria", () => {
  assert.equal(formatBirthDate("2021-09-23"), "23 de septiembre de 2021");
  assert.equal(formatBirthDate("2020-01-01"), "1 de enero de 2020");
  assert.equal(formatBirthDate(null), null);
});
test("todayLocal usa el calendario local, no UTC", () => {
  assert.equal(todayLocal(new Date(2026, 8, 23, 23, 59, 59)), "2026-09-23");
  assert.equal(todayLocal(new Date(2026, 0, 1, 0, 0, 1)), "2026-01-01");
});
test("cumpleaños: hoy sí; mañana y ayer no; el año da la edad", () => {
  assert.equal(birthdayAge("2021-09-23", "2026-09-23"), 5);
  assert.equal(birthdayAge("2021-09-24", "2026-09-23"), null);
  assert.equal(birthdayAge("2021-09-22", "2026-09-23"), null);
  assert.equal(birthdayAge("2025-09-23", "2026-09-23"), 1);
});
test("cumpleaños: el día de nacimiento (edad 0) no cuenta", () => {
  assert.equal(birthdayAge("2026-09-23", "2026-09-23"), null);
});
test("cumpleaños del 29-feb: 28-feb en año no bisiesto, 29-feb en bisiesto", () => {
  assert.equal(birthdayAge("2020-02-29", "2026-02-28"), 6);
  assert.equal(birthdayAge("2020-02-29", "2026-03-01"), null);
  assert.equal(birthdayAge("2020-02-29", "2028-02-29"), 8);
  assert.equal(birthdayAge("2020-02-29", "2028-02-28"), null);
});
test("sin fecha de nacimiento no hay cumpleaños", () => {
  assert.equal(birthdayAge(null, "2026-09-23"), null);
  assert.equal(birthdayAge("", "2026-09-23"), null);
});
test("texto de una mascota: concuerda con el sexo y no usa emojis", () => {
  const f = birthdayCopy([{ name: "Luna", age: 5, sex: "female" }]);
  assert.equal(f.headline, "Hoy Luna cumple 5 años.");
  assert.ok(f.thanks.includes("acompañarla, cuidarla"));
  const m = birthdayCopy([{ name: "Max", age: 1, sex: "male" }]);
  assert.equal(m.headline, "Hoy Max cumple 1 año.");
  assert.ok(m.thanks.includes("acompañarlo, cuidarlo"));
  const n = birthdayCopy([{ name: "Kira", age: 3, sex: null }]);
  assert.ok(n.thanks.includes("Kira"));
  for (const c of [f, m, n]) assert.ok(!/\p{Extended_Pictographic}/u.test(Object.values(c).join(" ")));
});
test("varias mascotas el mismo día: una sola ventana con todas", () => {
  const c = birthdayCopy([
    { name: "Luna", age: 5, sex: "female" },
    { name: "Max", age: 3, sex: "male" },
    { name: "Kira", age: 1, sex: null },
  ]);
  assert.equal(c.headline, "Hoy Luna cumple 5 años, Max cumple 3 años y Kira cumple 1 año.");
  assert.ok(c.thanks.includes("acompañarlos"));
  assert.equal(birthdayCopy([{ name: "A", age: 2, sex: null }, { name: "B", age: 4, sex: null }]).headline, "Hoy A cumple 2 años y B cumple 4 años.");
});
test("nota de años humanos: texto exacto y sin conversión numérica", () => {
  assert.ok(HUMAN_AGE_NOTE.startsWith("Quisiéramos calcular su edad exacta en años humanos"));
  assert.ok(HUMAN_AGE_NOTE.endsWith("te va a querer como un buen compañero."));
  assert.ok(!/\d/.test(HUMAN_AGE_NOTE));
});

console.log(`\n${passed} pruebas OK${process.exitCode ? " (HAY FALLAS)" : ""}`);
