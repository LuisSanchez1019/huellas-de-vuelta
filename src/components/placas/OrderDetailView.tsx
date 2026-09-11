"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  cancelPlateOrder,
  fetchMyOrderDetail,
  formatCOP,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  SHIPMENT_EVENT_LABEL,
  plateErrorMessage,
  type OrderDetail,
} from "@/lib/supabase/plateOrders";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "./placas.module.css";

const PROGRESS: { key: string; label: string }[] = [
  { key: "pending", label: "Solicitud creada" },
  { key: "confirmed", label: "Pago confirmado" },
  { key: "preparing", label: "Preparando" },
  { key: "ready_to_ship", label: "Listo para envío" },
  { key: "shipped", label: "Enviado" },
  { key: "delivered", label: "Entregado" },
];

function rank(status: string): number {
  const i = PROGRESS.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
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

export default function OrderDetailView({ orderId, justCreated }: { orderId: string; justCreated: boolean }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(
    justCreated ? { variant: "success", message: "Solicitud creada. Coordinaremos el pago y el envío." } : null,
  );

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      try {
        setOrder(await fetchMyOrderDetail(createSupabaseBrowserClient(), orderId));
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function doCancel() {
    setBusy(true);
    try {
      await cancelPlateOrder(createSupabaseBrowserClient(), orderId);
      setToast({ variant: "success", message: "Pedido cancelado." });
      setConfirmCancel(false);
      await load();
    } catch (err) {
      setToast({ variant: "error", message: plateErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <p className={controls.loading}>Cargando…</p>;
  if (state === "error" || !order) {
    return (
      <p className={styles.emptyText}>
        No fue posible cargar este pedido. <Link href="/dashboard/pedidos">Volver a mis pedidos</Link>.
      </p>
    );
  }

  const cancelled = order.orderStatus === "cancelled";
  const currentRank = cancelled ? -1 : rank(order.orderStatus);

  return (
    <div className={styles.flow}>
      <Link className={styles.rowButton} href="/dashboard/pedidos">← Mis pedidos</Link>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Pedido {order.reference}</p>
        <div className={controls.sectionBody}>
          <dl className={styles.detailGrid}>
            <dt>Mascota</dt><dd>{order.petName ?? "—"}</dd>
            <dt>Placa</dt><dd>{order.plateCode ?? "Se asigna al preparar el envío"}</dd>
            <dt>Estado</dt><dd>{ORDER_STATUS_LABEL[order.orderStatus]}</dd>
            <dt>Pago</dt><dd>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</dd>
            {order.shipment && (
              <>
                <dt>Guía</dt><dd>{order.shipment.trackingNumber}</dd>
                {order.shipment.carrier && (<><dt>Transportadora</dt><dd>{order.shipment.carrier}{order.shipment.service ? ` · ${order.shipment.service}` : ""}</dd></>)}
              </>
            )}
          </dl>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Seguimiento</p>
        <div className={controls.sectionBody}>
          {cancelled ? (
            <p className={styles.emptyText}>Este pedido fue cancelado.</p>
          ) : (
            <div className={styles.timeline}>
              {PROGRESS.map((step, index) => (
                <div key={step.key} className={styles.tlStep}>
                  <span className={`${styles.tlDot} ${index <= currentRank ? styles.tlDotDone : ""}`} />
                  <div className={styles.tlBody}>
                    <span className={styles.tlTitle}>{step.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {order.shipmentEvents.length > 0 && (
            <div className={styles.timeline} style={{ marginTop: ".5rem" }}>
              {order.shipmentEvents.map((event, index) => (
                <div key={index} className={styles.tlStep}>
                  <span className={`${styles.tlDot} ${styles.tlDotDone}`} />
                  <div className={styles.tlBody}>
                    <span className={styles.tlTitle}>
                      {SHIPMENT_EVENT_LABEL[event.status] ?? event.status}
                    </span>
                    {event.description && <span className={styles.tlTime}>{event.description}</span>}
                    <span className={styles.tlTime}>{formatDateTime(event.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Envío y pago</p>
        <div className={controls.sectionBody}>
          <div className={styles.summary}>
            <div className={styles.summaryRow}><span>Placa</span><span>{formatCOP(order.productAmount, order.currency)}</span></div>
            <div className={styles.summaryRow}><span>Envío</span><span>{formatCOP(order.shippingAmount, order.currency)}</span></div>
            <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>Total</span><span>{formatCOP(order.totalAmount, order.currency)}</span></div>
          </div>
          <dl className={styles.detailGrid} style={{ marginTop: ".8rem" }}>
            <dt>Destinatario</dt><dd>{order.recipient}</dd>
            <dt>Dirección</dt><dd>{order.address}, {order.neighborhood}, {order.city}</dd>
            <dt>Celular</dt><dd>{order.phone}</dd>
            <dt>Correo</dt><dd>{order.email}</dd>
          </dl>

          {order.orderStatus === "pending" && order.paymentStatus === "pending" && (
            <div className={controls.buttonRow}>
              <button type="button" className={controls.buttonDanger} onClick={() => setConfirmCancel(true)} disabled={busy}>
                Cancelar solicitud
              </button>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancelar solicitud"
        message="Se cancelará esta solicitud de placa. Podrás crear una nueva más adelante."
        confirmLabel={busy ? "Cancelando…" : "Sí, cancelar"}
        cancelLabel="No"
        tone="danger"
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
