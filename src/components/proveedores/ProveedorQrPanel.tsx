"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  createProviderQrBatch,
  listProviderQrBatches,
  listProviderQrTags,
  providerQrErrorMessage,
  PROVIDER_QR_QUANTITIES,
  type ProviderQrBatch,
  type ProviderQrQuantity,
  type ProviderQrTag,
} from "@/lib/supabase/qrProvider";
import { QR_STATUS_LABEL } from "@/lib/supabase/qr";
import {
  downloadQrGroupZip,
  downloadQrPng,
  downloadQrSvg,
  QR_PHYSICAL_SIZES_CM,
  type QrPhysicalSizeCm,
} from "@/lib/qr/download";
import Toast, { type ToastState } from "@/components/ui/Toast";
import { TableSkeletonBody } from "@/components/loading/SkeletonVariants";
import { DownloadIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "@/app/admin/qr/qr.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ProveedorQrPanel() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [batches, setBatches] = useState<ProviderQrBatch[]>([]);
  const [quantity, setQuantity] = useState<ProviderQrQuantity>(5);
  const [note, setNote] = useState("");
  const [sizeCm, setSizeCm] = useState<QrPhysicalSizeCm>(4);
  const [creating, setCreating] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [tagsByBatch, setTagsByBatch] = useState<Record<string, ProviderQrTag[]>>({});
  const [tagsLoading, setTagsLoading] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      try {
        setBatches(await listProviderQrBatches(createSupabaseBrowserClient()));
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const result = await createProviderQrBatch(createSupabaseBrowserClient(), {
        quantity,
        note: note.trim() || null,
      });
      setToast({
        variant: "success",
        message: `Lote creado: ${result.quantity} placas (${result.firstCode} – ${result.lastCode}).`,
      });
      setNote("");
      await load();
    } catch (error) {
      setToast({ variant: "error", message: providerQrErrorMessage(error) });
    } finally {
      setCreating(false);
    }
  }

  async function toggleBatch(batch: ProviderQrBatch) {
    if (expandedBatch === batch.id) {
      setExpandedBatch(null);
      return;
    }
    setExpandedBatch(batch.id);
    if (tagsByBatch[batch.id]) return;
    setTagsLoading(batch.id);
    try {
      const { rows } = await listProviderQrTags(createSupabaseBrowserClient(), { batchId: batch.id, limit: 20 });
      setTagsByBatch((prev) => ({ ...prev, [batch.id]: rows }));
    } catch (error) {
      setToast({ variant: "error", message: providerQrErrorMessage(error) });
    } finally {
      setTagsLoading(null);
    }
  }

  async function handleDownloadSvg(tag: ProviderQrTag) {
    const key = `${tag.id}-svg`;
    setBusyAction(key);
    try {
      await downloadQrSvg({ shortCode: tag.shortCode, publicId: tag.publicId }, sizeCm);
    } catch (error) {
      setToast({ variant: "error", message: providerQrErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownloadPng(tag: ProviderQrTag) {
    const key = `${tag.id}-png`;
    setBusyAction(key);
    try {
      await downloadQrPng({ shortCode: tag.shortCode, publicId: tag.publicId }, sizeCm);
    } catch (error) {
      setToast({ variant: "error", message: providerQrErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownloadZip(batch: ProviderQrBatch) {
    setBusyAction(batch.id);
    try {
      const tags = tagsByBatch[batch.id] ?? (await listProviderQrTags(createSupabaseBrowserClient(), { batchId: batch.id, limit: 20 })).rows;
      if (tags.length === 0) {
        setToast({ variant: "error", message: "Este lote no tiene placas." });
        return;
      }
      await downloadQrGroupZip(
        tags.map((t) => ({ shortCode: t.shortCode, publicId: t.publicId })),
        sizeCm,
        `qr-${batch.reference}`,
      );
    } catch (error) {
      setToast({ variant: "error", message: providerQrErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div>
      <form className={controls.section} onSubmit={submitCreate}>
        <p className={controls.sectionTitle}>Crear lote de códigos QR</p>
        <div className={controls.sectionBody}>
          <div className={controls.row2}>
            <label className={controls.field}>
              Cantidad
              <select
                className={controls.select}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value) as ProviderQrQuantity)}
              >
                {PROVIDER_QR_QUANTITIES.map((q) => (
                  <option key={q} value={q}>
                    {q} {q === 1 ? "código" : "códigos"}
                  </option>
                ))}
              </select>
            </label>
            <label className={controls.field}>
              Nota (opcional)
              <input
                className={controls.input}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={300}
                placeholder="Para qué son estos códigos"
              />
            </label>
          </div>
          <p className={controls.notice}>
            Los códigos quedan <b>disponibles</b>, sin asignar a ninguna mascota. La asignación a una
            mascota todavía no está disponible en la plataforma.
          </p>
          <div className={controls.buttonRow}>
            <button type="submit" className={controls.button} disabled={creating}>
              {creating ? "Generando…" : "Crear lote"}
            </button>
          </div>
        </div>
      </form>

      <div className={controls.field} style={{ margin: "1.25rem 0", maxWidth: "16rem" }}>
        Tamaño físico para descargar
        <select className={controls.select} value={sizeCm} onChange={(event) => setSizeCm(Number(event.target.value) as QrPhysicalSizeCm)}>
          {QR_PHYSICAL_SIZES_CM.map((cm) => (
            <option key={cm} value={cm}>
              {cm} cm
            </option>
          ))}
        </select>
      </div>

      {state === "loading" && <TableSkeletonBody />}
      {state === "error" && <p className={styles.empty}>No fue posible cargar tus lotes.</p>}
      {state === "ready" && batches.length === 0 && (
        <p className={styles.empty}>Todavía no has creado ningún lote. Crea el primero arriba.</p>
      )}

      {state === "ready" && batches.length > 0 && (
        <div className={styles.batchGrid}>
          {batches.map((batch) => (
            <div key={batch.id} className={styles.batchCard}>
              <div className={styles.batchHead}>
                <div>
                  <p className={styles.batchName}>{batch.reference}</p>
                  <p className={styles.batchMeta}>{batch.total} códigos · creado {formatDate(batch.createdAt)}</p>
                </div>
              </div>
              {batch.note && <p className={styles.batchMeta}>{batch.note}</p>}
              <div className={styles.countRow}>
                <span className={styles.countPill}><b>{batch.available}</b> disponibles</span>
                <span className={styles.countPill}><b>{batch.assigned}</b> asignados</span>
                <span className={styles.countPill}><b>{batch.active}</b> activos</span>
              </div>
              <div className={controls.buttonRow}>
                <button type="button" className={controls.buttonSecondary} onClick={() => toggleBatch(batch)}>
                  {expandedBatch === batch.id ? "Ocultar códigos" : "Ver códigos"}
                </button>
                <button
                  type="button"
                  className={controls.buttonSecondary}
                  disabled={busyAction === batch.id}
                  onClick={() => handleDownloadZip(batch)}
                >
                  <DownloadIcon size={16} /> {busyAction === batch.id ? "Preparando…" : "Descargar todo (ZIP)"}
                </button>
              </div>

              {expandedBatch === batch.id && (
                <div className={styles.tableWrap}>
                  {tagsLoading === batch.id ? (
                    <TableSkeletonBody />
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Estado</th>
                          <th>Descargar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tagsByBatch[batch.id] ?? []).map((tag) => (
                          <tr key={tag.id}>
                            <td className={styles.code}>{tag.shortCode}</td>
                            <td>
                              <span className={`${styles.badge} ${styles[`badge_${tag.status}`]}`}>
                                {QR_STATUS_LABEL[tag.status]}
                              </span>
                            </td>
                            <td>
                              <div className={controls.buttonRow} style={{ margin: 0 }}>
                                <button
                                  type="button"
                                  className={styles.rowButton}
                                  disabled={busyAction === `${tag.id}-svg`}
                                  onClick={() => handleDownloadSvg(tag)}
                                >
                                  SVG
                                </button>
                                <button
                                  type="button"
                                  className={styles.rowButton}
                                  disabled={busyAction === `${tag.id}-png`}
                                  onClick={() => handleDownloadPng(tag)}
                                >
                                  PNG
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
