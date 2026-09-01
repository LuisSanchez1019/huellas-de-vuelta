"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { bulkPetRepository } from "@/lib/pets/bulkPetRepository";
import type { OrgScope } from "@/lib/pets/bulkPets";
import { speciesLabels, sexLabels } from "@/lib/pets/labels";
import {
  EXAMPLE_ROW,
  EXPECTED_COLUMNS,
  parsePetsWorkbook,
  type ParsePetsResult,
} from "@/lib/excel/parsePets";
import controls from "@/components/ui/controls.module.css";
import styles from "./excelUploader.module.css";

type Phase = "idle" | "parsing" | "preview" | "confirming" | "done";

export default function ExcelPetUploader({ scope, backHref }: { scope: OrgScope; backHref: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ParsePetsResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  function reset() {
    setPhase("idle");
    setFileName("");
    setResult(null);
    setImportedCount(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setPhase("parsing");
    const parsed = await parsePetsWorkbook(file);
    setResult(parsed);
    setPhase("preview");
  }

  async function confirmImport() {
    if (!result || result.valid.length === 0) return;
    setPhase("confirming");
    try {
      const created = await bulkPetRepository.createMany(scope, result.valid);
      setImportedCount(created.length);
      setPhase("done");
    } catch {
      setPhase("preview");
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
            <span className={styles.dropzoneHint}>Solo se importarán las filas válidas. Puedes revisar la vista previa antes de confirmar.</span>
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
          ) : (
            <>
              <p className={styles.counts}>
                <span className={styles.countOk}>{result.valid.length} válidas</span>
                {result.errors.length > 0 && <span className={styles.countBad}>{result.errors.length} con errores</span>}
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
                  <p className={styles.errorTitle}>Filas que no se importarán</p>
                  <ul className={styles.errorList}>
                    {result.errors.map((error, index) => (
                      <li key={index}>Fila {error.row}, columna “{error.column}”: {error.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className={controls.buttonRow} style={{ marginTop: "1.25rem" }}>
            {!result.fatal && result.valid.length > 0 && (
              <button type="button" className={controls.button} onClick={confirmImport}>
                Confirmar carga ({result.valid.length})
              </button>
            )}
            <button type="button" className={controls.buttonSecondary} onClick={reset}>
              {result.fatal ? "Elegir otro archivo" : "Cancelar"}
            </button>
          </div>
        </div>
      )}

      {phase === "confirming" && <p className={controls.loading}>Cargando mascotas…</p>}

      {phase === "done" && (
        <div className={controls.section}>
          <p className={styles.doneTitle}>Se procesaron {importedCount} mascota{importedCount === 1 ? "" : "s"}.</p>
          <p className={controls.sectionBody}>Ya aparecen en tu lista de mascotas.</p>
          <div className={controls.buttonRow} style={{ marginTop: "1rem" }}>
            <Link href={backHref} className={controls.button}>Ver mascotas</Link>
            <button type="button" className={controls.buttonSecondary} onClick={reset}>Cargar otro archivo</button>
          </div>
        </div>
      )}
    </div>
  );
}
