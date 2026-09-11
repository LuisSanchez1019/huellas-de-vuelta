"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchMyPlateOrders,
  formatCOP,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
  type MyOrderRow,
} from "@/lib/supabase/plateOrders";
import controls from "@/components/ui/controls.module.css";
import styles from "./placas.module.css";

function badgeClass(status: string): string {
  if (["approved", "delivered"].includes(status)) return styles.badgeOk;
  if (["rejected", "cancelled", "exception"].includes(status)) return styles.badgeDanger;
  if (["shipped", "in_transit", "out_for_delivery", "confirmed", "preparing", "ready_to_ship"].includes(status)) {
    return styles.badgeInfo;
  }
  return styles.badge;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MyOrdersList() {
  const [state, setState] = useState<"loading" | "ready" | "no-session" | "error">("loading");
  const [orders, setOrders] = useState<MyOrderRow[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setState("no-session");
        return;
      }
      try {
        setOrders(await fetchMyPlateOrders(supabase));
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, []);

  if (state === "loading") return <p className={controls.loading}>Cargando…</p>;
  if (state === "no-session") {
    return <p className={styles.emptyText}>Inicia sesión con una cuenta real para ver tus pedidos.</p>;
  }
  if (state === "error") return <p className={styles.emptyText}>No fue posible cargar tus pedidos.</p>;
  if (orders.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Todavía no tienes pedidos de placa.</p>
        <Link className={controls.button} href="/dashboard/mascotas/solicitar-placa">
          Solicitar placa
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.orders}>
      {orders.map((order) => (
        <div key={order.id} className={styles.orderCard}>
          <div className={styles.orderHead}>
            <span className={styles.orderRef}>{order.reference}</span>
            <span className={styles.orderMeta}>{formatDate(order.createdAt)}</span>
          </div>
          <div className={styles.orderMeta}>
            {order.petName ?? "—"}
            {order.plateCode ? ` · Placa ${order.plateCode}` : ""}
            {order.trackingNumber ? ` · Guía ${order.trackingNumber}` : ""}
          </div>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${badgeClass(order.orderStatus)}`}>
              {ORDER_STATUS_LABEL[order.orderStatus]}
            </span>
            <span className={`${styles.badge} ${badgeClass(order.paymentStatus)}`}>
              Pago: {PAYMENT_STATUS_LABEL[order.paymentStatus]}
            </span>
            {order.shipmentStatus && (
              <span className={`${styles.badge} ${badgeClass(order.shipmentStatus)}`}>
                Envío: {SHIPMENT_STATUS_LABEL[order.shipmentStatus]}
              </span>
            )}
          </div>
          <div className={styles.orderHead}>
            <span className={styles.orderMeta}>Total {formatCOP(order.totalAmount, order.currency)}</span>
            <Link className={styles.rowButton} href={`/dashboard/pedidos/${order.id}`}>
              Ver seguimiento
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
