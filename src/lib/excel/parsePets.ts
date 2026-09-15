import { readSheet, type SheetData } from "read-excel-file/browser";
import type { BulkPetInput, BulkPetStatus } from "@/lib/pets/bulkPets";
import type { PetSex, PetSpecies } from "@/lib/supabase/types";

export interface RowError {
  row: number;
  column: string;
  message: string;
}

export interface RowDuplicate {
  row: number;
  name: string;
  reason: "archivo" | "existente";
}

export interface ParsePetsResult {
  /** Error que impide continuar (archivo/columnas). Si es null, se puede previsualizar. */
  fatal: string | null;
  valid: BulkPetInput[];
  errors: RowError[];
  /**
   * Filas que por lo demás son válidas pero parecen duplicadas (mismo nombre +
   * especie + fecha de ingreso) de otra fila del mismo archivo. Se excluyen de
   * `valid` por defecto — no se crean solas por parecer iguales, para que una
   * carga repetida del mismo archivo no duplique mascotas.
   */
  duplicates: RowDuplicate[];
  /** Filas de datos leídas (válidas + inválidas + duplicadas). */
  total: number;
}

/**
 * La foto NO se importa por Excel a propósito: se agrega mascota por mascota
 * desde el listado, una vez creados los registros (ver Fase 4). Mantener esto
 * fuera de la importación evita mezclar "cargar datos" con "subir fotos" y
 * evita URLs externas sin control de formato/tamaño en Storage.
 */
export const EXPECTED_COLUMNS: { header: string; required: boolean; hint: string }[] = [
  { header: "Nombre", required: true, hint: "texto" },
  { header: "Especie", required: true, hint: "Perro | Gato | Otro" },
  { header: "Raza", required: false, hint: "texto" },
  { header: "Edad", required: false, hint: 'texto, ej. "3 años"' },
  { header: "Sexo", required: true, hint: "Macho | Hembra | No especificado" },
  { header: "Estado", required: false, hint: "Disponible | En tratamiento | Reservada | Con hogar" },
  { header: "Fecha de ingreso", required: false, hint: "fecha (AAAA-MM-DD)" },
];

export const EXAMPLE_ROW: Record<string, string> = {
  Nombre: "Canela",
  Especie: "Perro",
  Raza: "Criolla",
  Edad: "3 años",
  Sexo: "Hembra",
  Estado: "Disponible",
  "Fecha de ingreso": "2026-08-01",
};

/** Clave de "misma mascota" para detectar duplicados: nombre + especie + fecha. */
function dedupeKey(input: Pick<BulkPetInput, "name" | "species" | "intakeDate">): string {
  return `${input.name.trim().toLowerCase()}|${input.species}|${input.intakeDate ?? ""}`;
}

const SPECIES_MAP: Record<string, PetSpecies> = { perro: "dog", gato: "cat", otro: "other" };
const SEX_MAP: Record<string, PetSex> = {
  macho: "male",
  hembra: "female",
  "no especificado": "unspecified",
};
const STATUS_MAP: Record<string, BulkPetStatus> = {
  disponible: "available",
  "en tratamiento": "in_treatment",
  reservada: "reserved",
  "con hogar": "adopted",
};

function cell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export async function parsePetsWorkbook(file: File): Promise<ParsePetsResult> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return {
      fatal: "El archivo debe estar en formato .xlsx (Excel). Exporta o guarda tu hoja como .xlsx.",
      valid: [],
      errors: [],
      duplicates: [],
      total: 0,
    };
  }

  let rows: SheetData;
  try {
    rows = await readSheet(file);
  } catch {
    return {
      fatal: "No se pudo leer el archivo. Verifica que sea un .xlsx válido y que no esté dañado.",
      valid: [],
      errors: [],
      duplicates: [],
      total: 0,
    };
  }

  if (rows.length === 0) {
    return { fatal: "El archivo está vacío.", valid: [], errors: [], duplicates: [], total: 0 };
  }

  const headers = rows[0].map((header) => cell(header));
  const missing = EXPECTED_COLUMNS.filter((column) => column.required && !headers.includes(column.header)).map(
    (column) => column.header,
  );
  if (missing.length > 0) {
    return {
      fatal: `Faltan columnas obligatorias: ${missing.join(", ")}. Se esperan estas columnas: ${EXPECTED_COLUMNS.map((column) => column.header).join(", ")}.`,
      valid: [],
      errors: [],
      duplicates: [],
      total: 0,
    };
  }

  const indexOf = (header: string) => headers.indexOf(header);
  const dataRows = rows.slice(1).filter((row) => row.some((value) => cell(value) !== ""));
  if (dataRows.length === 0) {
    return {
      fatal: "El archivo no tiene registros de mascotas (solo encabezados).",
      valid: [],
      errors: [],
      duplicates: [],
      total: 0,
    };
  }

  const valid: BulkPetInput[] = [];
  const errors: RowError[] = [];
  const validRowNumbers: number[] = [];

  dataRows.forEach((row, position) => {
    const rowNumber = position + 2; // +1 encabezado, +1 base 1
    const rowErrors: RowError[] = [];

    const name = cell(row[indexOf("Nombre")]);
    if (!name) rowErrors.push({ row: rowNumber, column: "Nombre", message: "El nombre es obligatorio." });

    const speciesText = cell(row[indexOf("Especie")]);
    const species = SPECIES_MAP[speciesText.toLowerCase()];
    if (!species) {
      rowErrors.push({
        row: rowNumber,
        column: "Especie",
        message: `Especie no válida ("${speciesText}"). Usa Perro, Gato u Otro.`,
      });
    }

    const sexText = cell(row[indexOf("Sexo")]);
    const sex = SEX_MAP[sexText.toLowerCase()];
    if (!sex) {
      rowErrors.push({
        row: rowNumber,
        column: "Sexo",
        message: `Sexo no válido ("${sexText}"). Usa Macho, Hembra o No especificado.`,
      });
    }

    let status: BulkPetStatus | undefined;
    const statusIndex = indexOf("Estado");
    const statusText = statusIndex >= 0 ? cell(row[statusIndex]) : "";
    if (statusText) {
      status = STATUS_MAP[statusText.toLowerCase()];
      if (!status) {
        rowErrors.push({
          row: rowNumber,
          column: "Estado",
          message: `Estado no válido ("${statusText}"). Usa Disponible, En tratamiento, Reservada o Con hogar.`,
        });
      }
    }

    if (rowErrors.length > 0 || !species || !sex) {
      errors.push(...rowErrors);
      return;
    }

    const read = (header: string) => {
      const i = indexOf(header);
      return i >= 0 ? cell(row[i]) || null : null;
    };

    valid.push({
      name,
      species,
      breed: read("Raza"),
      age: read("Edad"),
      sex,
      status,
      intakeDate: read("Fecha de ingreso"),
    });
    validRowNumbers.push(rowNumber);
  });

  // Duplicados DENTRO del mismo archivo (mismo nombre+especie+fecha repetido):
  // se conserva la primera aparición y las siguientes se excluyen y se reportan.
  const seen = new Map<string, number>();
  const duplicates: RowDuplicate[] = [];
  const deduped: BulkPetInput[] = [];
  valid.forEach((input, i) => {
    const key = dedupeKey(input);
    if (seen.has(key)) {
      duplicates.push({ row: validRowNumbers[i], name: input.name, reason: "archivo" });
      return;
    }
    seen.set(key, validRowNumbers[i]);
    deduped.push(input);
  });

  return { fatal: null, valid: deduped, errors, duplicates, total: dataRows.length };
}

/**
 * Marca como duplicadas (y las excluye) las filas ya válidas que coinciden
 * con una mascota que la organización ya tiene registrada (mismo nombre +
 * especie + fecha de ingreso). Se aplica DESPUÉS de leer el archivo, porque
 * requiere conocer las mascotas ya existentes — así una carga repetida del
 * mismo archivo no crea duplicados.
 */
export function excludeExistingDuplicates(
  result: ParsePetsResult,
  existing: Pick<BulkPetInput, "name" | "species" | "intakeDate">[],
): ParsePetsResult {
  const existingKeys = new Set(existing.map(dedupeKey));
  const valid: BulkPetInput[] = [];
  const duplicates = [...result.duplicates];
  result.valid.forEach((input) => {
    if (existingKeys.has(dedupeKey(input))) {
      duplicates.push({ row: 0, name: input.name, reason: "existente" });
      return;
    }
    valid.push(input);
  });
  return { ...result, valid, duplicates };
}
