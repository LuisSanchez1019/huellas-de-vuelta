"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  adminAddShipmentEvent,
  adminListShipments,
  plateErrorMessage,
  SHIPMENT_STATUS_LABEL,
  type AdminShipmentRow,
  type ShipmentStatus,
} from "@/lib/supabase/plateOrders";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "../pedidos/pedidos.module.css";

const FILTERS: ShipmentStatus[] = [
  "preparing",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "cancelled",
];

const NEXT_EVENTS: { value: string; label: string }[] = [
  { value: "SHIPPED", label: "Enviado" },
  { value: "IN_TRANSIT", label: "En tránsito" },
  { value: "OUT_FOR_DELIVERY", label: "En reparto" },
  { value: "DELIVERED", label: "Entregado" },
  { value: "EXCEPTION", label: "Novedad" },
];

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

function badgeClass(status: string): string {
  if (status === "delivered") return styles.badgeOk;
  if (["exception", "cancelled"].includes(status)) return styles.badgeDanger;
  if (status === "preparing") return styles.badgeWarn;
  return styles.badgeInfo;
}

export default function AdminEnviosPage() {
  const [filter, setFilter] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rows, setRows] = useState<AdminShipmentRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      setState("loading");
      try {
        setRows(await adminListShipments(createSupabaseBrowserClient(), filter || null));
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function addEvent(shipment: AdminShipmentRow, status: string) {
    if (status === "DELIVERED" && !window.confirm("¿Marcar como entregado? La placa quedará activa y pública.")) {
      return;
    }
    setBusyId(shipment.id);
    try {
      await adminAddShipmentEvent(createSupabaseBrowserClient(), shipment.id, status);
      setToast({ variant: "success", message: "Estado del envío actualizado." });
      await load();
    } catch (err) {
      setToast({ variant: "error", message: plateErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Envíos</h1>
        <p className={controls.pageSubtitle}>
          Envíos de placas con su número de guía. Al marcar “Entregado”, la placa se activa y el QR
          empieza a identificar a la mascota.
        </p>
      </div>

      <div className={styles.filters}>
        <label className={controls.field}>
          Estado
          <select className={controls.input} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todos</option>
            {FILTERS.map((s) => (
              <option key={s} value={s}>{SHIPMENT_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
      </div>

      {state === "loading" && <p className={controls.loading}>Cargando…</p>}
      {state === "error" && <p className={styles.empty}>No fue posible cargar los envíos.</p>}
      {state === "ready" && rows.length === 0 && <p className={styles.empty}>No hay envíos en esta categoría.</p>}

      {state === "ready" && rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Guía</th>
                <th>Pedido</th>
                <th>Mascota</th>
                <th>Ciudad</th>
                <th>Estado</th>
                <th>Enviado</th>
                <th>Entregado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className={styles.ref}>{s.trackingNumber}</td>
                  <td>{s.orderReference}</td>
                  <td>{s.petName ?? "—"}</td>
                  <td>{s.city}</td>
                  <td><span className={`${styles.badge} ${badgeClass(s.status)}`}>{SHIPMENT_STATUS_LABEL[s.status]}</span></td>
                  <td>{formatDateTime(s.shippedAt)}</td>
                  <td>{formatDateTime(s.deliveredAt)}</td>
                  <td>
                    {s.status !== "delivered" && s.status !== "cancelled" ? (
                      <div style={{ display: "flex", gap: ".35rem", flexWrap: "wrap" }}>
                        {NEXT_EVENTS.map((ev) => (
                          <button
                            key={ev.value}
                            type="button"
                            className={styles.rowButton}
                            disabled={busyId === s.id}
                            onClick={() => addEvent(s, ev.value)}
                          >
                            {ev.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
