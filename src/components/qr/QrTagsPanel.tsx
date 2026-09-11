"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  assignQrTag,
  listQrBatches,
  listQrTags,
  qrErrorMessage,
  qrTagDetail,
  qrTagEvents,
  qrTagSetState,
  replaceQrTag,
  searchPetsForQr,
  QR_STATUS_LABEL,
  type QrBatch,
  type QrPetSearchResult,
  type QrStateAction,
  type QrTag,
  type QrTagDetail,
  type QrTagEvent,
  type QrTagStatus,
} from "@/lib/supabase/qr";
import { petPublicUrl } from "@/lib/pets/publicPet";
import { qrSvgString } from "@/lib/qr/svg";
import { CloseIcon } from "@/components/icons/Icon";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "@/app/admin/qr/qr.module.css";

const PAGE_SIZE = 50;
const STATUS_ORDER: QrTagStatus[] = [
  "available",
  "assigned",
  "active",
  "suspended",
  "replaced",
  "annulled",
];

const EVENT_LABEL: Record<string, string> = {
  generated: "Generada",
  assigned: "Asignada",
  activated: "Activada",
  unassigned: "Desasignada",
  suspended: "Suspendida",
  resumed: "Reanudada",
  replaced: "Reemplazada",
  annulled: "Anulada",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function QrTagsPanel({ reloadSignal }: { reloadSignal: number }) {
  const [batches, setBatches] = useState<QrBatch[]>([]);
  const [batchId, setBatchId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);

  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rows, setRows] = useState<QrTag[]>([]);
  const [total, setTotal] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    listQrBatches(createSupabaseBrowserClient()).then(setBatches).catch(() => setBatches([]));
  }, [reloadSignal]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  function changeBatch(value: string) {
    setBatchId(value);
    setPage(0);
  }
  function changeStatus(value: string) {
    setStatus(value);
    setPage(0);
  }

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      setState("loading");
      try {
        const result = await listQrTags(createSupabaseBrowserClient(), {
          batchId: batchId || null,
          status: (status || null) as QrTagStatus | null,
          query: debounced || null,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setRows(result.rows);
        setTotal(result.total);
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, [batchId, status, debounced, page]);

  useEffect(() => {
    load();
  }, [load, reloadSignal]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className={styles.filters}>
        <label className={controls.field}>
          Lote
          <select className={controls.input} value={batchId} onChange={(e) => changeBatch(e.target.value)}>
            <option value="">Todos</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.reference}
              </option>
            ))}
          </select>
        </label>
        <label className={controls.field}>
          Estado
          <select className={controls.input} value={status} onChange={(e) => changeStatus(e.target.value)}>
            <option value="">Todos</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {QR_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className={controls.field}>
          Buscar
          <input
            className={controls.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código, token o nombre de mascota"
          />
        </label>
      </div>

      {state === "loading" && <p className={controls.loading}>Cargando placas…</p>}
      {state === "error" && <p className={styles.empty}>No fue posible cargar las placas.</p>}
      {state === "ready" && rows.length === 0 && (
        <p className={styles.empty}>No hay placas con esos criterios.</p>
      )}

      {state === "ready" && rows.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Lote</th>
                  <th>Mascota</th>
                  <th>Actualizada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((tag) => (
                  <tr key={tag.id}>
                    <td className={styles.code}>{tag.shortCode}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`badge_${tag.status}`]}`}>
                        {QR_STATUS_LABEL[tag.status]}
                      </span>
                    </td>
                    <td>{tag.batchReference}</td>
                    <td>{tag.petName ?? "—"}</td>
                    <td>{formatDateTime(tag.updatedAt)}</td>
                    <td>
                      <button type="button" className={styles.rowButton} onClick={() => setOpenId(tag.id)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pager}>
            <span className={styles.batchMeta}>
              {total} placa{total === 1 ? "" : "s"} · página {page + 1} de {pageCount}
            </span>
            <button
              type="button"
              className={controls.buttonSecondary}
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className={controls.buttonSecondary}
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}

      {openId && (
        <QrTagDetailModal
          tagId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            load();
          }}
          onToast={setToast}
        />
      )}

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function QrTagDetailModal({
  tagId,
  onClose,
  onChanged,
  onToast,
}: {
  tagId: string;
  onClose: () => void;
  onChanged: () => void;
  onToast: (toast: ToastState) => void;
}) {
  const [detail, setDetail] = useState<QrTagDetail | null>(null);
  const [events, setEvents] = useState<QrTagEvent[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"view" | "assign" | "replace">("view");

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const [d, e] = await Promise.all([qrTagDetail(supabase, tagId), qrTagEvents(supabase, tagId)]);
        setDetail(d);
        setEvents(e);
        setState(d ? "ready" : "error");
      } catch {
        setState("error");
      }
    });
  }, [tagId]);

  useEffect(() => {
    load();
  }, [load]);

  const qrDataUrl = useMemo(() => {
    if (!detail) return null;
    try {
      const svg = qrSvgString(petPublicUrl(detail.publicId, window.location.origin), { border: 2 });
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    } catch {
      return null;
    }
  }, [detail]);

  async function runState(action: QrStateAction, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    let reason: string | undefined;
    if (action === "annul" || action === "suspend" || action === "unassign") {
      const input = window.prompt("Motivo (opcional, queda en el historial):", "");
      if (input === null) return;
      reason = input.trim() || undefined;
    }
    setBusy(true);
    try {
      await qrTagSetState(createSupabaseBrowserClient(), tagId, action, reason);
      onToast({ variant: "success", message: "Placa actualizada." });
      await load();
      onChanged();
    } catch (error) {
      onToast({ variant: "error", message: qrErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function doAssign(pet: QrPetSearchResult, activate: boolean) {
    setBusy(true);
    try {
      await assignQrTag(createSupabaseBrowserClient(), {
        tagId,
        petKind: pet.petKind,
        petId: pet.petId,
        activate,
      });
      onToast({ variant: "success", message: `Placa asignada a ${pet.name}.` });
      setMode("view");
      await load();
      onChanged();
    } catch (error) {
      onToast({ variant: "error", message: qrErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function doReplace(newTag: QrTag) {
    if (!window.confirm(`Reemplazar ${detail?.shortCode} por ${newTag.shortCode}? La mascota conserva su perfil.`)) {
      return;
    }
    setBusy(true);
    try {
      await replaceQrTag(createSupabaseBrowserClient(), { oldTagId: tagId, newTagId: newTag.id });
      onToast({ variant: "success", message: `Placa reemplazada por ${newTag.shortCode}.` });
      setMode("view");
      await load();
      onChanged();
    } catch (error) {
      onToast({ variant: "error", message: qrErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHead}>
          <p className={styles.modalTitle}>{detail?.shortCode ?? "Placa"}</p>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
            <CloseIcon size={20} />
          </button>
        </div>

        {state === "loading" && <p className={controls.loading}>Cargando…</p>}
        {state === "error" && <p className={styles.empty}>No fue posible cargar la placa.</p>}

        {state === "ready" && detail && (
          <>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
              {qrDataUrl && (
                <div className={styles.qrPreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- SVG generado en el cliente (data URL) */}
                  <img src={qrDataUrl} alt={`Código QR de ${detail.shortCode}`} />
                </div>
              )}
              <dl className={styles.detailGrid}>
                <dt>Estado</dt>
                <dd>
                  <span className={`${styles.badge} ${styles[`badge_${detail.status}`]}`}>
                    {QR_STATUS_LABEL[detail.status]}
                  </span>
                </dd>
                <dt>Lote</dt>
                <dd>{detail.batchReference}</dd>
                <dt>Token URL</dt>
                <dd>/m/{detail.publicId}</dd>
                <dt>Mascota</dt>
                <dd>
                  {detail.petName
                    ? `${detail.petName}${detail.petExtra ? ` · ${detail.petExtra}` : ""}`
                    : "Sin asignar"}
                </dd>
                {detail.petOwnerLabel && (
                  <>
                    <dt>Titular</dt>
                    <dd>{detail.petOwnerLabel}</dd>
                  </>
                )}
                <dt>Asignada</dt>
                <dd>{formatDateTime(detail.assignedAt)}</dd>
                {detail.replacedByCode && (
                  <>
                    <dt>Reemplazada por</dt>
                    <dd>{detail.replacedByCode}</dd>
                  </>
                )}
              </dl>
            </div>

            {mode === "view" && (
              <div className={controls.buttonRow}>
                {detail.status === "available" && (
                  <button type="button" className={controls.button} disabled={busy} onClick={() => setMode("assign")}>
                    Asignar a una mascota
                  </button>
                )}
                {detail.status === "assigned" && (
                  <button type="button" className={controls.button} disabled={busy} onClick={() => runState("activate")}>
                    Activar
                  </button>
                )}
                {detail.status === "active" && (
                  <>
                    <button type="button" className={controls.buttonSecondary} disabled={busy} onClick={() => runState("suspend")}>
                      Suspender
                    </button>
                    <button type="button" className={controls.buttonSecondary} disabled={busy} onClick={() => setMode("replace")}>
                      Reemplazar
                    </button>
                  </>
                )}
                {detail.status === "suspended" && (
                  <button type="button" className={controls.button} disabled={busy} onClick={() => runState("resume")}>
                    Reanudar
                  </button>
                )}
                {["assigned", "active", "suspended"].includes(detail.status) && (
                  <button type="button" className={controls.buttonSecondary} disabled={busy} onClick={() => runState("unassign")}>
                    Desasignar
                  </button>
                )}
                {detail.status !== "annulled" && detail.status !== "replaced" && (
                  <button
                    type="button"
                    className={controls.buttonDanger}
                    disabled={busy}
                    onClick={() => runState("annul", "¿Anular esta placa? No se podrá volver a usar.")}
                  >
                    Anular
                  </button>
                )}
              </div>
            )}

            {mode === "assign" && (
              <QrPetPicker
                busy={busy}
                onCancel={() => setMode("view")}
                onPick={(pet) => doAssign(pet, true)}
              />
            )}

            {mode === "replace" && (
              <QrReplacePicker
                busy={busy}
                onCancel={() => setMode("view")}
                onPick={doReplace}
              />
            )}

            <div>
              <p className={styles.sectionLabel}>Historial</p>
              <div className={styles.events}>
                {events.length === 0 && <p className={styles.batchMeta}>Sin eventos.</p>}
                {events.map((event) => (
                  <p key={event.id} className={styles.eventRow}>
                    <b>{EVENT_LABEL[event.event] ?? event.event}</b>
                    <span>{formatDateTime(event.createdAt)}</span>
                    {event.actorEmail && <span>· {event.actorEmail}</span>}
                    {event.reason && <span>· {event.reason}</span>}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function QrPetPicker({
  busy,
  onCancel,
  onPick,
}: {
  busy: boolean;
  onCancel: () => void;
  onPick: (pet: QrPetSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QrPetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;
    const id = window.setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2) {
        if (active) {
          setResults([]);
          setSearching(false);
        }
        return;
      }
      if (active) setSearching(true);
      try {
        const list = await searchPetsForQr(createSupabaseBrowserClient(), q);
        if (active) setResults(list);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [query]);

  return (
    <div className={controls.section} style={{ marginTop: 0 }}>
      <p className={controls.sectionTitle}>Asignar a una mascota</p>
      <div className={controls.sectionBody}>
        <label className={controls.field}>
          Buscar mascota
          <input
            className={controls.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre o identificador"
            autoFocus
          />
        </label>
        {searching && <p className={styles.batchMeta}>Buscando…</p>}
        <div className={styles.searchResults}>
          {results.map((pet) => (
            <button
              key={`${pet.petKind}:${pet.petId}`}
              type="button"
              className={styles.searchItem}
              disabled={busy || pet.hasLiveTag}
              onClick={() => onPick(pet)}
            >
              <span className={styles.searchItemMain}>
                <span className={styles.searchItemName}>{pet.name}</span>
                <span className={styles.searchItemMeta}>
                  {pet.extra ?? "—"}
                  {pet.ownerLabel ? ` · ${pet.ownerLabel}` : ""}
                  {pet.hasLiveTag ? ` · ya tiene placa ${pet.liveTagCode ?? ""}` : ""}
                </span>
              </span>
              <span className={styles.kindTag}>{pet.petKind === "owner" ? "Usuario" : "Organización"}</span>
            </button>
          ))}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className={styles.batchMeta}>Sin resultados.</p>
          )}
        </div>
        <div className={controls.buttonRow}>
          <button type="button" className={controls.buttonSecondary} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function QrReplacePicker({
  busy,
  onCancel,
  onPick,
}: {
  busy: boolean;
  onCancel: () => void;
  onPick: (tag: QrTag) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QrTag[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;
    const id = window.setTimeout(async () => {
      if (active) setSearching(true);
      try {
        const result = await listQrTags(createSupabaseBrowserClient(), {
          status: "available",
          query: query.trim() || null,
          limit: 20,
        });
        if (active) setResults(result.rows);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [query]);

  return (
    <div className={controls.section} style={{ marginTop: 0 }}>
      <p className={controls.sectionTitle}>Reemplazar por una placa disponible</p>
      <div className={controls.sectionBody}>
        <label className={controls.field}>
          Buscar placa disponible
          <input
            className={controls.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Código corto (HV-…)"
            autoFocus
          />
        </label>
        {searching && <p className={styles.batchMeta}>Buscando…</p>}
        <div className={styles.searchResults}>
          {results.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={styles.searchItem}
              disabled={busy}
              onClick={() => onPick(tag)}
            >
              <span className={styles.searchItemMain}>
                <span className={styles.searchItemName}>{tag.shortCode}</span>
                <span className={styles.searchItemMeta}>{tag.batchReference}</span>
              </span>
            </button>
          ))}
          {!searching && results.length === 0 && <p className={styles.batchMeta}>No hay placas disponibles.</p>}
        </div>
        <div className={controls.buttonRow}>
          <button type="button" className={controls.buttonSecondary} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
