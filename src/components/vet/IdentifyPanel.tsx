"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { QrIcon, SearchIcon } from "@/components/icons/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { vetErrorMessage } from "@/lib/vet/errors";
import {
  IDENTIFY_FAILURE_MESSAGES,
  identifyPet,
  isShortCode,
  normalizeCode,
  parseScanPayload,
  type IdentificationMethod,
  type IdentifyResult,
} from "@/lib/vet/identification";
import controls from "@/components/ui/controls.module.css";
import IdentifiedPetPanel from "./IdentifiedPetPanel";
import styles from "./vet.module.css";

// La cámara y ZXing NO forman parte del bundle inicial: solo se descargan al elegir escanear.
const CameraScanner = dynamic(() => import("./CameraScanner"), {
  ssr: false,
  loading: () => <p className={styles.meta}>Preparando la cámara…</p>,
});

type Mode = "menu" | "camera" | "reader";

/**
 * "Identificar mascota": escanear el QR de la placa con la cámara o con un lector de
 * QR (USB/Bluetooth, que teclea la URL y pulsa Enter). NFC llegará a futuro con el mismo
 * flujo. La placa identifica solo por QR/NFC; el código corto (short_code) NO identifica.
 * Identificar NO da acceso médico: el resultado solo trae información pública mínima y
 * el servidor comprueba que la organización veterinaria esté realmente aprobada.
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
    if (busyRef.current) return; // un lector puede disparar Enter dos veces
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

  function resolve(text: string): { code: string; method: IdentificationMethod } | null {
    const raw = normalizeCode(text);
    if (isShortCode(raw)) {
      setResult(null);
      setFailure("El código corto de la placa es interno y no identifica. Escanea el QR de la placa.");
      return null;
    }
    const resolved = parseScanPayload(raw);
    if (!resolved) {
      setResult(null);
      setFailure("El código leído no es un identificador de Huellas de Vuelta.");
      return null;
    }
    return resolved;
  }

  function onScanned(text: string) {
    setMode("menu"); // desmonta el escáner: apaga la cámara antes de consultar
    const resolved = resolve(text);
    if (resolved) void run(resolved.code, resolved.method);
  }

  function onReaderSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resolved = resolve(inputRef.current?.value ?? "");
    if (inputRef.current) inputRef.current.value = "";
    if (resolved) void run(resolved.code, resolved.method);
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
            <button type="button" className={styles.methodButton} disabled={busy} onClick={() => open("camera")}>
              <QrIcon size={22} /> Escanear QR con la cámara
            </button>
            <button type="button" className={styles.methodButton} disabled={busy} onClick={() => open("reader")}>
              <SearchIcon size={22} /> Usar un lector de QR
            </button>
          </div>
        )}

        {mode === "camera" && (
          <div style={{ marginTop: "1rem" }}>
            <CameraScanner onDetected={onScanned} onCancel={() => setMode("menu")} />
          </div>
        )}

        {mode === "reader" && (
          <form className={styles.manual} style={{ marginTop: "1rem" }} onSubmit={onReaderSubmit}>
            <label className={controls.field}>
              Lector de QR (USB o Bluetooth)
              <input
                ref={inputRef}
                className={controls.input}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                maxLength={300}
                placeholder="Escanea el QR de la placa"
                aria-describedby="reader-hint"
              />
              <span id="reader-hint" className={controls.hint}>Deja este campo seleccionado y escanea el QR: el lector envía Enter al terminar.</span>
            </label>
            <div className={controls.buttonRow}>
              <button type="submit" className={controls.button} disabled={busy}>{busy ? "Buscando…" : "Identificar"}</button>
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
