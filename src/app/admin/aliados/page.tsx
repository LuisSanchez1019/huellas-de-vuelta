"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  adminFetchAliadoVisibilityOrders,
  adminSetAliadoVisibilityPayment,
  adminSetAliadoVisibilitySettings,
  fetchAliadoVisibilitySettings,
  type AdminAliadoVisibilityOrder,
  type AliadoVisibilitySettings,
} from "@/lib/aliados/visibility";
import { formatCOP } from "@/lib/supabase/plateOrders";
import PromptDialog from "@/components/ui/PromptDialog";
import Toast, { type ToastState } from "@/components/ui/Toast";
import { TableSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";
import styles from "../organizaciones/organizaciones.module.css";

type Tab = "pending" | "vigente" | "vencido" | "otros";

const TAB_LABEL: Record<Tab, string> = {
  pending: "Pendientes",
  vigente: "Vigentes",
  vencido: "Vencidos",
  otros: "Rechazados / cancelados",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function formatDateOnly(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminAliadosPage() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<AdminAliadoVisibilityOrder[]>([]);
  const [settings, setSettings] = useState<AliadoVisibilitySettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({ dailyRate: "", minDays: "", maxDays: "" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingReject, setPendingReject] = useState<AdminAliadoVisibilityOrder | null>(null);
  const [pendingApprove, setPendingApprove] = useState<AdminAliadoVisibilityOrder | null>(null);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const [nextOrders, nextSettings] = await Promise.all([
          adminFetchAliadoVisibilityOrders(supabase),
          fetchAliadoVisibilitySettings(supabase),
        ]);
        setOrders(nextOrders);
        setSettings(nextSettings);
        setSettingsForm({
          dailyRate: String(nextSettings.dailyRate),
          minDays: String(nextSettings.minDays),
          maxDays: String(nextSettings.maxDays),
        });
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const base: Record<Tab, number> = { pending: 0, vigente: 0, vencido: 0, otros: 0 };
    for (const order of orders) {
      if (order.computedStatus === "pending") base.pending += 1;
      else if (order.computedStatus === "vigente") base.vigente += 1;
      else if (order.computedStatus === "vencido") base.vencido += 1;
      else base.otros += 1;
    }
    return base;
  }, [orders]);

  const visible = orders.filter((order) => {
    if (tab === "pending") return order.computedStatus === "pending";
    if (tab === "vigente") return order.computedStatus === "vigente";
    if (tab === "vencido") return order.computedStatus === "vencido";
    return order.computedStatus === "rejected" || order.computedStatus === "cancelled";
  });

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const dailyRate = Number(settingsForm.dailyRate);
    const minDays = Number(settingsForm.minDays);
    const maxDays = Number(settingsForm.maxDays);
    if (!Number.isInteger(dailyRate) || dailyRate <= 0) {
      setToast({ variant: "error", message: "La tarifa diaria debe ser un número entero mayor a cero." });
      return;
    }
    if (!Number.isInteger(minDays) || minDays <= 0) {
      setToast({ variant: "error", message: "La duración mínima debe ser un número entero mayor a cero." });
      return;
    }
    if (!Number.isInteger(maxDays) || maxDays < minDays) {
      setToast({ variant: "error", message: "La duración máxima debe ser mayor o igual a la mínima." });
      return;
    }
    setSavingSettings(true);
    try {
      await adminSetAliadoVisibilitySettings(createSupabaseBrowserClient(), { dailyRate, minDays, maxDays });
      setToast({ variant: "success", message: "Configuración actualizada. Las solicitudes futuras usarán estos valores; el historial no cambia." });
      await load();
    } catch (error) {
      setToast({ variant: "error", message: error instanceof Error ? error.message : "No fue posible guardar la configuración." });
    } finally {
      setSavingSettings(false);
    }
  }

  async function confirmApprove(reference: string) {
    const order = pendingApprove;
    if (!order) return;
    setPendingApprove(null);
    setBusyId(order.id);
    try {
      await adminSetAliadoVisibilityPayment(createSupabaseBrowserClient(), order.id, "approved", reference || undefined);
      setToast({ variant: "success", message: `Pago confirmado. «${order.orgName}» queda vigente ${order.days} días desde hoy.` });
      await load();
    } catch (error) {
      setToast({ variant: "error", message: error instanceof Error ? error.message : "No fue posible confirmar el pago." });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject(reason: string) {
    const order = pendingReject;
    if (!order) return;
    setPendingReject(null);
    setBusyId(order.id);
    try {
      await adminSetAliadoVisibilityPayment(createSupabaseBrowserClient(), order.id, "rejected", reason || undefined);
      setToast({ variant: "success", message: "Solicitud rechazada." });
      await load();
    } catch (error) {
      setToast({ variant: "error", message: error instanceof Error ? error.message : "No fue posible rechazar la solicitud." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Aliados</h1>
        <p className={controls.pageSubtitle}>
          Tarifa de visibilidad y solicitudes de las empresas aliadas. No existe pasarela de pagos: el
          pago se confirma manualmente aquí, igual que en pedidos de placa.
        </p>
      </div>

      <form className={styles.card} onSubmit={saveSettings} style={{ marginBottom: "1.5rem" }}>
        <p className={styles.name} style={{ marginTop: 0 }}>Configuración de tarifa</p>
        <p className={controls.notice} style={{ marginTop: ".5rem" }}>
          El valor aplicado a cada solicitud queda congelado en el momento en que se crea: cambiar estos
          valores no afecta solicitudes ya existentes.
        </p>
        <div className={controls.row2} style={{ marginTop: "1rem" }}>
          <label className={controls.field}>
            Tarifa diaria (COP)
            <input
              className={controls.input}
              type="number"
              min={1}
              step={1}
              value={settingsForm.dailyRate}
              onChange={(e) => setSettingsForm((f) => ({ ...f, dailyRate: e.target.value }))}
            />
          </label>
          <label className={controls.field}>
            Días mínimos
            <input
              className={controls.input}
              type="number"
              min={1}
              step={1}
              value={settingsForm.minDays}
              onChange={(e) => setSettingsForm((f) => ({ ...f, minDays: e.target.value }))}
            />
          </label>
          <label className={controls.field}>
            Días máximos
            <input
              className={controls.input}
              type="number"
              min={1}
              step={1}
              value={settingsForm.maxDays}
              onChange={(e) => setSettingsForm((f) => ({ ...f, maxDays: e.target.value }))}
            />
          </label>
        </div>
        {settings && (
          <p className={controls.notice} style={{ marginTop: ".75rem" }}>
            Vigente ahora: {formatCOP(settings.dailyRate)}/día · entre {settings.minDays} y {settings.maxDays} días.
          </p>
        )}
        <div className={controls.buttonRow} style={{ marginTop: "1rem" }}>
          <button type="submit" className={controls.button} disabled={savingSettings}>
            {savingSettings ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </form>

      <div className={styles.tabs} role="tablist">
        {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={tab === key ? styles.tabActive : styles.tab}
            onClick={() => setTab(key)}
          >
            {TAB_LABEL[key]} ({counts[key]})
          </button>
        ))}
      </div>

      {state === "loading" && <TableSkeletonBody />}
      {state === "error" && <p className={styles.empty}>No fue posible cargar las solicitudes.</p>}
      {state === "ready" && visible.length === 0 && (
        <p className={styles.empty}>No hay solicitudes en esta categoría.</p>
      )}

      {state === "ready" && visible.length > 0 && (
        <ul className={styles.list}>
          {visible.map((order) => (
            <li key={order.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <span className={styles.category}>{order.orgName}</span>
                  <p className={styles.name}>
                    {order.days} días · {formatCOP(order.dailyRateApplied)}/día
                  </p>
                </div>
                <span className={styles.statusWrap}>
                  <span className={`${styles.status} ${
                    order.computedStatus === "vigente" ? styles.status_approved
                      : order.computedStatus === "pending" ? styles.status_pending
                      : order.computedStatus === "rejected" ? styles.status_rejected
                      : styles.status_inactive
                  }`}>
                    {order.computedStatus === "vigente" ? "Vigente"
                      : order.computedStatus === "pending" ? "Pendiente"
                      : order.computedStatus === "vencido" ? "Vencido"
                      : order.computedStatus === "rejected" ? "Rechazado" : "Cancelado"}
                  </span>
                </span>
              </div>

              <dl className={styles.details}>
                <div><dt>Responsable</dt><dd>{order.ownerEmail ?? "—"}</dd></div>
                <div><dt>Total</dt><dd>{formatCOP(order.totalAmount)}</dd></div>
                <div><dt>Solicitado</dt><dd>{formatDate(order.requestedAt)}</dd></div>
                {order.startDate && order.endDate && (
                  <div><dt>Período</dt><dd>{formatDateOnly(order.startDate)} – {formatDateOnly(order.endDate)}</dd></div>
                )}
                {order.paymentReference && <div><dt>Referencia</dt><dd>{order.paymentReference}</dd></div>}
              </dl>

              {order.computedStatus === "pending" && (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.approve}
                    disabled={busyId === order.id}
                    onClick={() => setPendingApprove(order)}
                  >
                    Confirmar pago
                  </button>
                  <button
                    type="button"
                    className={styles.reject}
                    disabled={busyId === order.id}
                    onClick={() => setPendingReject(order)}
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <PromptDialog
        open={pendingApprove !== null}
        title="Confirmar pago"
        message={`«${pendingApprove?.orgName ?? ""}» quedará vigente ${pendingApprove?.days ?? ""} días a partir de hoy.`}
        label="Referencia de pago (opcional)"
        placeholder="Número de transferencia, comprobante, etc."
        confirmLabel={busyId === pendingApprove?.id ? "Guardando…" : "Confirmar pago"}
        cancelLabel="Cancelar"
        onConfirm={confirmApprove}
        onCancel={() => setPendingApprove(null)}
      />

      <PromptDialog
        open={pendingReject !== null}
        title="Rechazar solicitud"
        message={`El motivo lo verá «${pendingReject?.orgName ?? ""}» en su panel.`}
        label="Motivo del rechazo (opcional)"
        confirmLabel={busyId === pendingReject?.id ? "Guardando…" : "Rechazar"}
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={confirmReject}
        onCancel={() => setPendingReject(null)}
      />

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
