"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  adminAddShipmentEvent,
  adminAssignPlate,
  adminCreateShipment,
  adminListPlateOrders,
  adminOrderDetail,
  adminSetPaymentStatus,
  formatCOP,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
  plateErrorMessage,
  type AdminOrderRow,
  type OrderStatus,
} from "@/lib/supabase/plateOrders";
import { listQrTags, type QrTag } from "@/lib/supabase/qr";
import { CloseIcon } from "@/components/icons/Icon";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "./pedidos.module.css";

const STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
];
const PAGE = 50;

function badgeClass(status: string): string {
  if (["approved", "delivered"].includes(status)) return styles.badgeOk;
  if (["rejected", "cancelled", "exception"].includes(status)) return styles.badgeDanger;
  if (["pending"].includes(status)) return styles.badgeWarn;
  return styles.badgeInfo;
}

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

export default function AdminPedidosPage() {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  function changeStatus(value: string) {
    setStatus(value);
    setPage(0);
  }

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      setState("loading");
      try {
        const result = await adminListPlateOrders(createSupabaseBrowserClient(), {
          status: status || null,
          query: debounced || null,
          limit: PAGE,
          offset: page * PAGE,
        });
        setRows(result.rows);
        setTotal(result.total);
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, [status, debounced, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Pedidos de placa</h1>
        <p className={controls.pageSubtitle}>
          Solicitudes de placa de los usuarios. La dirección solo se muestra en el detalle, para
          gestionar el envío.
        </p>
      </div>

      <div className={styles.filters}>
        <label className={controls.field}>
          Estado
          <select className={controls.input} value={status} onChange={(e) => changeStatus(e.target.value)}>
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className={controls.field}>
          Buscar
          <input
            className={controls.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Referencia, correo, mascota o guía"
          />
        </label>
      </div>

      {state === "loading" && <p className={controls.loading}>Cargando…</p>}
      {state === "error" && <p className={styles.empty}>No fue posible cargar los pedidos.</p>}
      {state === "ready" && rows.length === 0 && <p className={styles.empty}>No hay pedidos con esos criterios.</p>}

      {state === "ready" && rows.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Usuario</th>
                  <th>Mascota</th>
                  <th>Pedido</th>
                  <th>Pago</th>
                  <th>Envío</th>
                  <th>Placa</th>
                  <th>Total</th>
                  <th>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id}>
                    <td className={styles.ref}>{order.reference}</td>
                    <td>{order.userEmail ?? "—"}</td>
                    <td>{order.petName ?? "—"}</td>
                    <td><span className={`${styles.badge} ${badgeClass(order.orderStatus)}`}>{ORDER_STATUS_LABEL[order.orderStatus]}</span></td>
                    <td><span className={`${styles.badge} ${badgeClass(order.paymentStatus)}`}>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</span></td>
                    <td>{order.shipmentStatus ? <span className={`${styles.badge} ${badgeClass(order.shipmentStatus)}`}>{SHIPMENT_STATUS_LABEL[order.shipmentStatus]}</span> : "—"}</td>
                    <td>{order.plateCode ?? "—"}</td>
                    <td>{formatCOP(order.totalAmount, order.currency)}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td><button type="button" className={styles.rowButton} onClick={() => setOpenId(order.id)}>Gestionar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.pager}>
            <span>{total} pedido{total === 1 ? "" : "s"} · página {page + 1} de {pageCount}</span>
            <button type="button" className={controls.buttonSecondary} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</button>
            <button type="button" className={controls.buttonSecondary} disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
          </div>
        </>
      )}

      {openId && (
        <AdminOrderModal
          orderId={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onToast={setToast}
        />
      )}
      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AdminOrderModal({
  orderId,
  onClose,
  onChanged,
  onToast,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
  onToast: (toast: ToastState) => void;
}) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"view" | "assign">("view");
  const [carrier, setCarrier] = useState("");
  const [service, setService] = useState("");

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      try {
        setDetail(await adminOrderDetail(createSupabaseBrowserClient(), orderId));
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      onToast({ variant: "success", message: ok });
      await load();
      onChanged();
    } catch (err) {
      onToast({ variant: "error", message: plateErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const shipment = (detail?.shipment as Record<string, unknown> | null) ?? null;
  const orderStatus = String(detail?.order_status ?? "");
  const paymentStatus = String(detail?.payment_status ?? "");
  const events = (detail?.shipment_events as { status: string; created_at: string }[]) ?? [];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <p className={styles.modalTitle}>{detail ? String(detail.reference) : "Pedido"}</p>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
            <CloseIcon size={20} />
          </button>
        </div>

        {state === "loading" && <p className={controls.loading}>Cargando…</p>}
        {state === "error" && <p className={styles.empty}>No fue posible cargar el pedido.</p>}

        {state === "ready" && detail && (
          <>
            <dl className={styles.detailGrid}>
              <dt>Usuario</dt><dd>{String(detail.user_email ?? "—")}</dd>
              <dt>Mascota</dt><dd>{String(detail.pet_name ?? "—")}</dd>
              <dt>Estado</dt><dd>{ORDER_STATUS_LABEL[orderStatus as OrderStatus] ?? orderStatus}</dd>
              <dt>Pago</dt><dd>{PAYMENT_STATUS_LABEL[paymentStatus as never] ?? paymentStatus}</dd>
              <dt>Placa</dt><dd>{String(detail.plate_code ?? "Sin asignar")}</dd>
              <dt>Total</dt><dd>{formatCOP(Number(detail.total_amount), String(detail.currency))} ({formatCOP(Number(detail.product_amount), String(detail.currency))} + {formatCOP(Number(detail.shipping_amount), String(detail.currency))})</dd>
              <dt>Zona</dt><dd>{String(detail.zone ?? "—")}</dd>
              <dt>Destinatario</dt><dd>{String(detail.recipient_first_name)} {String(detail.recipient_last_name)}</dd>
              <dt>Dirección</dt><dd>{String(detail.address)}, {String(detail.neighborhood)}, {String(detail.city)}</dd>
              <dt>Celular</dt><dd>{String(detail.phone)}</dd>
              <dt>Correo</dt><dd>{String(detail.email)}</dd>
              {shipment && (<><dt>Guía</dt><dd>{String(shipment.tracking_number)}</dd></>)}
            </dl>

            {mode === "view" && (
              <div className={controls.buttonRow}>
                {paymentStatus === "pending" && (
                  <>
                    <button type="button" className={controls.button} disabled={busy}
                      onClick={() => run(() => adminSetPaymentStatus(createSupabaseBrowserClient(), orderId, "approved", "manual"), "Pago aprobado.")}>
                      Marcar pago aprobado
                    </button>
                    <button type="button" className={controls.buttonSecondary} disabled={busy}
                      onClick={() => run(() => adminSetPaymentStatus(createSupabaseBrowserClient(), orderId, "rejected"), "Pago rechazado.")}>
                      Rechazar pago
                    </button>
                  </>
                )}
                {paymentStatus === "approved" && !detail.qr_tag_id && (
                  <button type="button" className={controls.button} disabled={busy} onClick={() => setMode("assign")}>
                    Asignar placa
                  </button>
                )}
                {Boolean(detail.qr_tag_id) && !shipment && ["preparing", "ready_to_ship"].includes(orderStatus) && (
                  <div style={{ display: "grid", gap: ".5rem", width: "100%" }}>
                    <div className={controls.row2}>
                      <input className={controls.input} placeholder="Transportadora (opcional)" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                      <input className={controls.input} placeholder="Servicio (opcional)" value={service} onChange={(e) => setService(e.target.value)} />
                    </div>
                    <button type="button" className={controls.button} disabled={busy}
                      onClick={() => run(async () => {
                        const r = await adminCreateShipment(createSupabaseBrowserClient(), orderId, carrier.trim() || null, service.trim() || null);
                        onToast({ variant: "success", message: `Envío creado. Guía ${r.trackingNumber}` });
                      }, "Envío creado.")}>
                      Crear envío y generar guía
                    </button>
                  </div>
                )}
                {shipment && shipment.status !== "delivered" && (
                  <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                    {shipment.status === "preparing" && (
                      <button type="button" className={controls.buttonSecondary} disabled={busy}
                        onClick={() => run(() => adminAddShipmentEvent(createSupabaseBrowserClient(), String(shipment.id), "SHIPPED"), "Marcado como enviado.")}>
                        Marcar enviado
                      </button>
                    )}
                    <button type="button" className={controls.button} disabled={busy}
                      onClick={() => run(() => adminAddShipmentEvent(createSupabaseBrowserClient(), String(shipment.id), "DELIVERED"), "Marcado como entregado. La placa quedó activa.")}>
                      Marcar entregado
                    </button>
                  </div>
                )}
              </div>
            )}

            {mode === "assign" && (
              <AssignPlate
                busy={busy}
                onCancel={() => setMode("view")}
                onPick={(tag) => run(async () => {
                  await adminAssignPlate(createSupabaseBrowserClient(), orderId, tag.id);
                  setMode("view");
                }, `Placa ${""}asignada.`)}
              />
            )}

            {events.length > 0 && (
              <div>
                <p className={styles.sectionLabel}>Eventos de envío</p>
                <div className={styles.events}>
                  {events.map((e, i) => (
                    <p key={i} className={styles.eventRow}>
                      <b>{e.status}</b><span>{formatDateTime(e.created_at)}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AssignPlate({
  busy,
  onCancel,
  onPick,
}: {
  busy: boolean;
  onCancel: () => void;
  onPick: (tag: QrTag) => void;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<QrTag[]>([]);
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
        if (active) setRows(result.rows);
      } catch {
        if (active) setRows([]);
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
      <p className={controls.sectionTitle}>Asignar una placa disponible</p>
      <div className={controls.sectionBody}>
        <label className={controls.field}>
          Buscar placa
          <input className={controls.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Código (HVD-…)" autoFocus />
        </label>
        {searching && <p className={styles.eventRow}>Buscando…</p>}
        <div className={styles.searchResults}>
          {rows.map((tag) => (
            <button key={tag.id} type="button" className={styles.searchItem} disabled={busy} onClick={() => onPick(tag)}>
              <span><strong>{tag.shortCode}</strong> · {tag.batchReference}</span>
            </button>
          ))}
          {!searching && rows.length === 0 && <p className={styles.eventRow}>No hay placas disponibles.</p>}
        </div>
        <div className={controls.buttonRow}>
          <button type="button" className={controls.buttonSecondary} onClick={onCancel} disabled={busy}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
