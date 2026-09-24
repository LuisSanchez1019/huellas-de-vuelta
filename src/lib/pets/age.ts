/**
 * Edad y cumpleaños de una mascota a partir de `birth_date` (fecha calendario, sin
 * hora). Todo es aritmética de calendario sobre cadenas `YYYY-MM-DD`: no hay
 * `Date` de por medio, así que la zona horaria no puede correr un día la fecha.
 * La "fecha de hoy" es siempre la fecha LOCAL del usuario (`todayLocal`).
 *
 * NO hay conversión a "años humanos": la edad mostrada es la edad real.
 */

export interface DateParts {
  y: number;
  m: number;
  d: number;
}

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Fecha más antigua aceptada (coincide con el trigger del servidor). */
export const MIN_BIRTH_DATE = "1980-01-01";

function isLeap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** `YYYY-MM-DD` estricto y con día realmente existente en el calendario; si no, `null`. */
export function parseDateOnly(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

/** Fecha calendario LOCAL del navegador como `YYYY-MM-DD` (nunca UTC). */
export function todayLocal(now: Date = new Date()): string {
  const y = String(now.getFullYear()).padStart(4, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface AgeParts {
  years: number;
  /** Meses completos en total (años * 12 + meses). */
  totalMonths: number;
}

/** Edad real a `today`. `null` si alguna fecha es inválida o el nacimiento es posterior a hoy. */
export function calcAge(birth: string | null | undefined, today: string): AgeParts | null {
  const b = parseDateOnly(birth);
  const t = parseDateOnly(today);
  if (!b || !t) return null;
  const totalMonths = (t.y - b.y) * 12 + (t.m - b.m) - (t.d < b.d ? 1 : 0);
  if (totalMonths < 0) return null;
  return { years: Math.floor(totalMonths / 12), totalMonths };
}

/** "5 años", "1 año", "8 meses", "1 mes" o "Menos de 1 mes". `null` si no hay edad calculable. */
export function formatAge(birth: string | null | undefined, today: string): string | null {
  const age = calcAge(birth, today);
  if (!age) return null;
  if (age.years >= 1) return `${age.years} ${age.years === 1 ? "año" : "años"}`;
  if (age.totalMonths >= 1) return `${age.totalMonths} ${age.totalMonths === 1 ? "mes" : "meses"}`;
  return "Menos de 1 mes";
}

/** "23 de septiembre de 2021". Independiente de la zona horaria. */
export function formatBirthDate(birth: string | null | undefined): string | null {
  const b = parseDateOnly(birth);
  return b ? `${b.d} de ${MONTH_NAMES[b.m - 1]} de ${b.y}` : null;
}

/** Alias legible para fechas que no son de nacimiento (vacunas). */
export const formatDateLong = formatBirthDate;

/** Mensaje de error para el formulario, o `null` si la fecha es válida (vacía también es válida: es opcional). */
export function validateBirthDate(value: string, today: string): string | null {
  if (!value.trim()) return null;
  const b = parseDateOnly(value);
  if (!b) return "La fecha de nacimiento no es válida.";
  if (value > today) return "La fecha de nacimiento no puede ser futura.";
  if (value < MIN_BIRTH_DATE) return "La fecha de nacimiento es demasiado antigua.";
  return null;
}

/**
 * ¿Cumple años `today`? Mismo día y mes que `birth`; el 29-feb se celebra el 28-feb en años
 * no bisiestos. El año de nacimiento determina la edad y se excluye el propio día de nacimiento.
 */
export function birthdayAge(birth: string | null | undefined, today: string): number | null {
  const b = parseDateOnly(birth);
  const t = parseDateOnly(today);
  if (!b || !t) return null;
  const sameDay = b.m === t.m && b.d === t.d;
  const leapBaby = b.m === 2 && b.d === 29 && !isLeap(t.y) && t.m === 2 && t.d === 28;
  if (!sameDay && !leapBaby) return null;
  const turning = t.y - b.y;
  return turning >= 1 ? turning : null;
}

export const HUMAN_AGE_NOTE =
  "Quisiéramos calcular su edad exacta en años humanos, pero la ciencia todavía no lo ha logrado. " +
  "Lo que sí sabemos es que, desde el primer hasta el último día, te va a querer como un buen compañero.";

export interface BirthdayPet {
  name: string;
  age: number;
  sex: string | null;
}

export interface BirthdayCopy {
  title: string;
  headline: string;
  thanks: string;
  closing: string;
}

const yearsText = (n: number) => `${n} ${n === 1 ? "año" : "años"}`;

/** Une "A cumple 5 años", "B cumple 3 años" y "C cumple 1 año" con comas y "y". */
function joinNatural(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/**
 * Texto de la ventana de cumpleaños (UNA sola ventana aunque haya varias mascotas).
 * Para una mascota, el agradecimiento concuerda con su sexo registrado; si no es
 * conocido se usa una frase neutra.
 */
export function birthdayCopy(pets: BirthdayPet[]): BirthdayCopy {
  const title = "¡Hoy hay algo que celebrar!";
  if (pets.length === 1) {
    const [pet] = pets;
    const thanks =
      pet.sex === "female"
        ? "Gracias por acompañarla, cuidarla y darle un hogar lleno de cariño."
        : pet.sex === "male"
          ? "Gracias por acompañarlo, cuidarlo y darle un hogar lleno de cariño."
          : `Gracias por acompañar, cuidar y darle un hogar lleno de cariño a ${pet.name}.`;
    return {
      title,
      headline: `Hoy ${pet.name} cumple ${yearsText(pet.age)}.`,
      thanks,
      closing: `¡Feliz cumpleaños, ${pet.name}!`,
    };
  }
  return {
    title,
    headline: `Hoy ${joinNatural(pets.map((p) => `${p.name} cumple ${yearsText(p.age)}`))}.`,
    thanks: "Gracias por acompañarlos, cuidarlos y compartir tantos momentos juntos.",
    closing: "¡Feliz cumpleaños a nuestros compañeros!",
  };
}
