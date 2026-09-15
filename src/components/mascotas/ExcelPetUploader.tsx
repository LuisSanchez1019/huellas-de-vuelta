"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { bulkPetRepository } from "@/lib/pets/bulkPetRepository";
import type { BulkPetInput, OrgScope } from "@/lib/pets/bulkPets";
import { speciesLabels, sexLabels } from "@/lib/pets/labels";
import {
  EXAMPLE_ROW,
  EXPECTED_COLUMNS,
  excludeExistingDuplicates,
  parsePetsWorkbook,
  type ParsePetsResult,
} from "@/lib/excel/parsePets";
import controls from "@/components/ui/controls.module.css";
import styles from "./excelUploader.module.css";

type Phase = "idle" | "parsing" | "preview" | "confirming" | "done";

/** Tope de filas por carga: un ciclo de inserción fila-por-fila (para que un
 *  registro inválido no tumbe a los demás, ver `confirmImport`) con cientos de
 *  filas ya implica muchas idas y vueltas a Supabase; por encima de esto es
 *  más sano pedir dos archivos más pequeños que una carga de varios minutos. */
const MAX_ROWS = 500;

interface RowFailure {
  name: string;
  message: string;
}

export default function ExcelPetUploader({ scope, backHref }: { scope: OrgScope; backHref: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ParsePetsResult | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [created, setCreated] = useState(0);
  const [failures, setFailures] = useState<RowFailure[]>([]);
  const [tooMany, setTooMany] = useState(false);

  function reset() {
    setPhase("idle");
    setFileName("");
    setResult(null);
    setProgress({ done: 0, total: 0 });
    setCreated(0);
    setFailures([]);
    setTooMany(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setPhase("parsing");
    const parsed = await parsePetsWorkbook(file);
    if (parsed.fatal) {
      setResult(parsed);
      setPhase("preview");
      return;
    }
    if (parsed.valid.length > MAX_ROWS) {
      setTooMany(true);
      setResult(parsed);
      setPhase("preview");
      return;
    }
    // Duplicados contra lo que la organización YA tiene registrado — así una
    // carga repetida del mismo archivo no crea mascotas de más.
    let withExistingCheck = parsed;
    try {
      const existing = await bulkPetRepository.list(scope);
      withExistingCheck = excludeExistingDuplicates(
        parsed,
        existing.map((pet) => ({ name: pet.name, species: pet.species, intakeDate: pet.intakeDate })),
      );
    } catch {
      /* si falla la comprobación de existentes, se continúa solo con el chequeo dentro del archivo */
    }
    setResult(withExistingCheck);
    setPhase("preview");
  }

  async function confirmImport() {
    if (!result || result.valid.length === 0 || result.valid.length > MAX_ROWS) return;
    setPhase("confirming");
    const rows = result.valid;
    setProgress({ done: 0, total: rows.length });
    const okList: BulkPetInput[] = [];
    const failList: RowFailure[] = [];

    // Fila por fila (no un solo insert masivo): así un registro que la base de
    // datos rechace (ej. una restricción que la validación del archivo no
    // haya previsto) no hace fallar a los demás — se reporta esa fila y se
    // sigue con el resto. La organización dueña la garantiza RLS en cada
    // inserción individual, igual que el resto de la app. Todo el ciclo va en
    // un try/finally: pase lo que pase, la pantalla siempre termina en "done"
    // con un resumen, nunca se queda congelada en "confirming".
    try {
      for (let i = 0; i < rows.length; i++) {
        try {
          await bulkPetRepository.createMany(scope, [rows[i]]);
          okList.push(rows[i]);
        } catch (error) {
          failList.push({
            name: rows[i].name,
            message: error instanceof Error ? error.message : "No fue posible crear el registro.",
          });
        }
        setProgress({ done: i + 1, total: rows.length });
      }
    } finally {
      setCreated(okList.length);
      setFailures(failList);
      setPhase("done");
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className={styles.hiddenInput}
        onChange={handleFile}
      />

      {phase === "idle" && (
        <>
          <button type="button" className={styles.dropzone} onClick={() => inputRef.current?.click()}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
            </svg>
            <span className={styles.dropzoneTitle}>Selecciona un archivo .xlsx</span>
            <span className={styles.dropzoneHint}>
              Solo se importarán las filas válidas. Puedes revisar la vista previa antes de confirmar. La
              fotografía de cada mascota se agrega después, una por una, desde el listado.
            </span>
          </button>

          <div className={controls.section}>
            <p className={controls.sectionTitle}>Columnas esperadas</p>
            <div className={styles.tableWrap}>
              <table className={styles.schemaTable}>
                <thead>
                  <tr><th>Columna</th><th>Obligatoria</th><th>Formato</th><th>Ejemplo</th></tr>
                </thead>
                <tbody>
                  {EXPECTED_COLUMNS.map((column) => (
                    <tr key={column.header}>
                      <td><strong>{column.header}</strong></td>
                      <td>{column.required ? "Sí" : "No"}</td>
                      <td>{column.hint}</td>
                      <td>{EXAMPLE_ROW[column.header] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {phase === "parsing" && <p className={controls.loading}>Leyendo “{fileName}”…</p>}

      {phase === "preview" && result && (
        <div>
          <p className={styles.fileLabel}>Archivo: <strong>{fileName}</strong></p>

          {result.fatal ? (
            <p className={styles.fatal} role="alert">{result.fatal}</p>
          ) : tooMany ? (
            <p className={styles.fatal} role="alert">
              El archivo tiene {result.valid.length} filas válidas; el máximo por carga es {MAX_ROWS}. Divide
              el archivo en partes más pequeñas y cárgalas por separado.
            </p>
          ) : (
            <>
              <p className={styles.counts}>
                <span className={styles.countOk}>{result.valid.length} válidas</span>
                {result.errors.length > 0 && <span className={styles.countBad}>{result.errors.length} con errores</span>}
                {result.duplicates.length > 0 && (
                  <span className={`${styles.countBad} ${styles.countDup}`}>{result.duplicates.length} duplicadas</span>
                )}
                <span className={styles.countTotal}>{result.total} filas leídas</span>
              </p>

              {result.valid.length > 0 && (
                <div className={styles.tableWrap}>
                  <table className={styles.previewTable}>
                    <thead>
                      <tr><th>Nombre</th><th>Especie</th><th>Raza</th><th>Edad</th><th>Sexo</th></tr>
                    </thead>
                    <tbody>
                      {result.valid.map((pet, index) => (
                        <tr key={index}>
                          <td>{pet.name}</td>
                          <td>{pet.species === "other" ? pet.speciesOther || "Otro" : speciesLabels[pet.species]}</td>
                          <td>{pet.breed || "—"}</td>
                          <td>{pet.age || "—"}</td>
                          <td>{sexLabels[pet.sex]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className={styles.errorBox}>
                  <p className={styles.errorTitle}>Filas que no se importarán (errores)</p>
                  <ul className={styles.errorList}>
                    {result.errors.map((error, index) => (
                      <li key={index}>Fila {error.row}, columna “{error.column}”: {error.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.duplicates.length > 0 && (
                <div className={styles.dupBox}>
                  <p className={styles.dupTitle}>Filas que no se importarán (posibles duplicados)</p>
                  <p className={styles.dupHint}>
                    Mismo nombre, especie y fecha de ingreso que otra fila del archivo o que una mascota que
                    ya tienes registrada. Si son animales distintos, cambia el nombre o la fecha en el
                    archivo y vuelve a cargarlo.
                  </p>
                  <ul className={styles.dupList}>
                    {result.duplicates.map((dup, index) => (
                      <li key={index}>
                        {dup.reason === "archivo" ? `Fila ${dup.row}` : "Ya registrada"}: {dup.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className={controls.buttonRow} style={{ marginTop: "1.25rem" }}>
            {!result.fatal && !tooMany && result.valid.length > 0 && (
              <button type="button" className={controls.button} onClick={confirmImport}>
                Confirmar carga ({result.valid.length})
              </button>
            )}
            <button type="button" className={controls.buttonSecondary} onClick={reset}>
              {result.fatal || tooMany ? "Elegir otro archivo" : "Cancelar"}
            </button>
          </div>
        </div>
      )}

      {phase === "confirming" && (
        <div className={styles.progressWrap} role="status">
          <p className={styles.progressText}>
            Creando mascotas… {progress.done} de {progress.total}
          </p>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className={controls.section}>
          <p className={styles.doneTitle}>Se crearon {created} mascota{created === 1 ? "" : "s"}.</p>
          <div className={styles.resultRow}>
            <span className={styles.countOk}>{created} creadas</span>
            {failures.length > 0 && <span className={styles.countBad}>{failures.length} con error</span>}
          </div>
          {failures.length > 0 && (
            <div className={styles.errorBox}>
              <p className={styles.errorTitle}>No se pudieron crear estos registros</p>
              <ul className={styles.failList}>
                {failures.map((failure, index) => (
                  <li key={index}>{failure.name}: {failure.message}</li>
                ))}
              </ul>
            </div>
          )}
          <p className={controls.sectionBody}>
            Ya aparecen en tu lista de mascotas. Ahora puedes agregarles la foto una por una desde ahí.
          </p>
          <div className={controls.buttonRow} style={{ marginTop: "1rem" }}>
            <Link href={backHref} className={controls.button}>Ver mascotas</Link>
            <button type="button" className={controls.buttonSecondary} onClick={reset}>Cargar otro archivo</button>
          </div>
        </div>
      )}
    </div>
  );
}
