"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  createQrBatch,
  exportQrBatch,
  listQrBatches,
  qrErrorMessage,
  type QrBatch,
} from "@/lib/supabase/qr";
import { openQrPrintSheet } from "@/lib/qr/printSheet";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "@/app/admin/qr/qr.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function QrBatchPanel({ onBatchCreated }: { onBatchCreated: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [batches, setBatches] = useState<QrBatch[]>([]);
  const [reference, setReference] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [ranges, setRanges] = useState<Record<string, { from: string; to: string }>>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      try {
        setBatches(await listQrBatches(createSupabaseBrowserClient()));
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const qty = Number(quantity);
    if (reference.trim().length < 2) {
      setToast({ variant: "error", message: "Escribe una referencia para el lote (mín. 2 caracteres)." });
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 5000) {
      setToast({ variant: "error", message: "La cantidad debe ser un número entre 1 y 5000." });
      return;
    }
    setBusy(true);
    try {
      const result = await createQrBatch(createSupabaseBrowserClient(), {
        reference: reference.trim(),
        quantity: qty,
        note: note.trim() || null,
      });
      setToast({
        variant: "success",
        message: `Lote creado: ${result.quantity} placas (${result.firstCode} – ${result.lastCode}).`,
      });
      setReference("");
      setQuantity("100");
      setNote("");
      await load();
      onBatchCreated();
    } catch (error) {
      setToast({ variant: "error", message: qrErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function print(batch: QrBatch) {
    setPrintingId(batch.id);
    try {
      const range = ranges[batch.id];
      const rows = await exportQrBatch(
        createSupabaseBrowserClient(),
        batch.id,
        range?.from.trim() || null,
        range?.to.trim() || null,
      );
      if (rows.length === 0) {
        setToast({ variant: "error", message: "No hay placas en ese rango." });
        return;
      }
      const ok = openQrPrintSheet(
        rows.map((row) => ({ shortCode: row.shortCode, publicId: row.publicId })),
        window.location.origin,
        batch.reference,
      );
      if (!ok) {
        setToast({
          variant: "error",
          message: "El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e inténtalo de nuevo.",
        });
      }
    } catch (error) {
      setToast({ variant: "error", message: qrErrorMessage(error) });
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <div>
      <form className={controls.section} onSubmit={submit}>
        <p className={controls.sectionTitle}>Nuevo lote</p>
        <div className={controls.sectionBody}>
          <div className={controls.row2}>
            <label className={controls.field}>
              Referencia del lote
              <input
                className={controls.input}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={120}
                placeholder="Producción enero 2027"
              />
            </label>
            <label className={controls.field}>
              Cantidad
              <input
                className={controls.input}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="500"
              />
            </label>
          </div>
          <label className={controls.field}>
            Nota (opcional)
            <input
              className={controls.input}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
              placeholder="Proveedor, formato de placa, etc."
            />
          </label>
          <p className={controls.notice}>
            Al crear el lote se generan los identificadores únicos (código corto <b>HV-######</b> y token
            aleatorio para la URL). Las placas quedan <b>disponibles</b> hasta que se asignen a una mascota.
          </p>
          <div className={controls.buttonRow}>
            <button type="submit" className={controls.button} disabled={busy}>
              {busy ? "Generando…" : "Crear lote y generar placas"}
            </button>
          </div>
        </div>
      </form>

      {state === "loading" && <p className={controls.loading}>Cargando lotes…</p>}
      {state === "error" && <p className={styles.empty}>No fue posible cargar los lotes.</p>}
      {state === "ready" && batches.length === 0 && (
        <p className={styles.empty}>Todavía no hay lotes. Crea el primero arriba.</p>
      )}

      {state === "ready" && batches.length > 0 && (
        <div className={styles.batchGrid}>
          {batches.map((batch) => (
            <div key={batch.id} className={styles.batchCard}>
              <div className={styles.batchHead}>
                <div>
                  <p className={styles.batchName}>{batch.reference}</p>
                  <p className={styles.batchMeta}>
                    {batch.total} placas · creado {formatDate(batch.createdAt)}
                    {batch.isSystem ? " · lote del sistema" : ""}
                  </p>
                </div>
              </div>
              {batch.note && <p className={styles.batchMeta}>{batch.note}</p>}
              <div className={styles.countRow}>
                <span className={styles.countPill}><b>{batch.available}</b> disponibles</span>
                <span className={styles.countPill}><b>{batch.assigned}</b> asignadas</span>
                <span className={styles.countPill}><b>{batch.active}</b> activas</span>
                <span className={styles.countPill}><b>{batch.suspended}</b> suspendidas</span>
                <span className={styles.countPill}><b>{batch.replaced}</b> reemplazadas</span>
                <span className={styles.countPill}><b>{batch.annulled}</b> anuladas</span>
              </div>
              <div className={styles.filters} style={{ margin: 0 }}>
                <label className={controls.field} style={{ minWidth: "8rem", flex: "0 1 10rem" }}>
                  Desde (opcional)
                  <input
                    className={controls.input}
                    placeholder="HV-000001"
                    value={ranges[batch.id]?.from ?? ""}
                    onChange={(event) =>
                      setRanges((prev) => ({
                        ...prev,
                        [batch.id]: { from: event.target.value, to: prev[batch.id]?.to ?? "" },
                      }))
                    }
                  />
                </label>
                <label className={controls.field} style={{ minWidth: "8rem", flex: "0 1 10rem" }}>
                  Hasta (opcional)
                  <input
                    className={controls.input}
                    placeholder="HV-000500"
                    value={ranges[batch.id]?.to ?? ""}
                    onChange={(event) =>
                      setRanges((prev) => ({
                        ...prev,
                        [batch.id]: { from: prev[batch.id]?.from ?? "", to: event.target.value },
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className={controls.buttonSecondary}
                  disabled={printingId === batch.id || batch.total === 0}
                  onClick={() => print(batch)}
                >
                  {printingId === batch.id ? "Preparando…" : "Imprimir / exportar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
