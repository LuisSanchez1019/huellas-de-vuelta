"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { CameraIcon, QrIcon, SearchIcon } from "@/components/icons/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { vetErrorMessage } from "@/lib/vet/errors";
import {
  IDENTIFY_FAILURE_MESSAGES,
  identifyPet,
  isPlausibleCode,
  normalizeCode,
  parseScanPayload,
  type IdentificationMethod,
  type IdentifyResult,
} from "@/lib/vet/identification";
import type { ScanFormat } from "@/lib/scanner/scanner";
import controls from "@/components/ui/controls.module.css";
import IdentifiedPetPanel from "./IdentifiedPetPanel";
import styles from "./vet.module.css";

// La cámara y ZXing NO forman parte del bundle inicial: solo se descargan al elegir escanear.
const CameraScanner = dynamic(() => import("./CameraScanner"), {
  ssr: false,
  loading: () => <p className={styles.meta}>Preparando la cámara…</p>,
});

type Mode = "menu" | ScanFormat | "manual";

/**
 * "Identificar mascota": escanear QR, escanear código de barras o escribir el
 * código (también sirve un lector HID, que teclea el código y pulsa Enter).
 * Sin cámara ni escáner visibles hasta que se pide. Identificar NO da acceso
 * médico: el resultado solo trae información pública mínima.
 */
export default function IdentifyPanel() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<Mode>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ found: Extract<IdentifyResult, { outcome: "found" }>; method: IdentificationMethod } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  async function run(code: string, method: IdentificationMethod) {
    if (busyRef.current) return; // un lector HID puede disparar Enter dos veces
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setFailure(null);
    setResult(null);
    try {
      const outcome = await identifyPet(supabase, code, method);
      if (outcome.outcome === "found") {
        setResult({ found: outcome, method });
        setMode("menu");
      } else {
        setFailure(IDENTIFY_FAILURE_MESSAGES[outcome.outcome]);
      }
    } catch (e) {
      setError(vetErrorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onScanned(text: string, format: ScanFormat) {
    setMode("menu"); // desmonta el escáner: apaga la cámara antes de consultar
    const resolved = parseScanPayload(text, format);
    if (!resolved) {
      setFailure("El código leído no es un identificador de Huellas de Vuelta.");
      return;
    }
    void run(resolved.code, resolved.method);
  }

  function onManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = inputRef.current?.value ?? "";
    // Se acepta también una URL pegada (/m/<id>): se extrae solo el token.
    const resolved = parseScanPayload(raw, "barcode");
    const code = resolved?.code ?? normalizeCode(raw);
    if (!isPlausibleCode(code)) {
      setResult(null);
      setFailure("El código no tiene un formato válido. Ejemplo: ABC-001.");
      return;
    }
    void run(code, "manual").then(() => {
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function open(next: Mode) {
    setMode(next);
    setResult(null);
    setFailure(null);
    setError(null);
  }

  return (
    <div>
      <section className={controls.section}>
        <div className={controls.sectionHead}>
          <h2 className={controls.sectionTitle}>Identificar mascota</h2>
        </div>
        <p className={styles.meta} style={{ marginTop: ".4rem" }}>
          Identificar una mascota no da acceso a su historia clínica: eso requiere la autorización del propietario.
        </p>

        {mode === "menu" && (
          <div className={styles.methodGrid} style={{ marginTop: "1rem" }}>
            <button type="button" className={styles.methodButton} disabled={busy} onClick={() => open("qr")}>
              <QrIcon size={22} /> Escanear QR
            </button>
            <button type="button" className={styles.methodButton} disabled={busy} onClick={() => open("barcode")}>
              <CameraIcon size={22} /> Escanear código de barras
            </button>
            <button type="button" className={styles.methodButton} disabled={busy} onClick={() => open("manual")}>
              <SearchIcon size={22} /> Introducir código
            </button>
          </div>
        )}

        {(mode === "qr" || mode === "barcode") && (
          <div style={{ marginTop: "1rem" }}>
            <CameraScanner format={mode} onDetected={(text) => onScanned(text, mode)} onCancel={() => setMode("menu")} />
          </div>
        )}

        {mode === "manual" && (
          <form className={styles.manual} style={{ marginTop: "1rem" }} onSubmit={onManualSubmit}>
            <label className={controls.field}>
              Código de la placa
              <input
                ref={inputRef}
                className={controls.input}
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={60}
                placeholder="ABC-001"
                aria-describedby="code-hint"
              />
              <span id="code-hint" className={controls.hint}>Escríbelo o usa un lector de código de barras (envía Enter al terminar).</span>
            </label>
            <div className={controls.buttonRow}>
              <button type="submit" className={controls.button} disabled={busy}>{busy ? "Buscando…" : "Buscar"}</button>
              <button type="button" className={controls.buttonSecondary} onClick={() => setMode("menu")}>Cancelar</button>
            </div>
          </form>
        )}

        {busy && <p className={styles.meta} style={{ marginTop: "1rem" }}>Identificando…</p>}
        {failure && <p className={controls.errorText} role="alert" style={{ marginTop: "1rem" }}>{failure}</p>}
        {error && <p className={controls.errorText} role="alert" style={{ marginTop: "1rem" }}>{error}</p>}
      </section>

      {result && <IdentifiedPetPanel key={result.found.tagPublicId} supabase={supabase} found={result.found} method={result.method} />}
    </div>
  );
}
