"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  createAliadoVisibilityRequest,
  fetchAliadoVisibilitySettings,
  fetchMyAliadoVisibilityOrders,
  type AliadoVisibilityOrder,
  type AliadoVisibilitySettings,
} from "@/lib/aliados/visibility";
import { formatCOP } from "@/lib/supabase/plateOrders";
import Toast, { type ToastState } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { ChevronDownIcon } from "@/components/icons/Icon";
import { FormSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";
import styles from "./aliadoVisibility.module.css";

const STATUS_LABEL: Record<AliadoVisibilityOrder["computedStatus"], string> = {
  pending: "En revisión",
  vigente: "Vigente",
  vencido: "Vencido",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Bloque "Apoya a Huellas de Vuelta": el aliado elige cuántos días quiere
 * aparecer como aliado y ve el total calculado al instante (días × tarifa
 * diaria vigente). El total mostrado aquí es solo para verlo de inmediato —
 * el servidor (`aliado_visibility_quote` / `aliado_visibility_request_create`)
 * SIEMPRE lo vuelve a calcular con la tarifa vigente en ese momento.
 *
 * Esto NO es un pago: crea una solicitud pendiente. Un administrador la
 * confirma manualmente (todavía no hay pasarela). Nada aquí hace público al
 * aliado por el solo hecho de elegir días.
 */
export default function AliadoVisibilityCard() {
  const [settings, setSettings] = useState<AliadoVisibilitySettings | null>(null);
  const [orders, setOrders] = useState<AliadoVisibilityOrder[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "no-session" | "error">("loading");
  const [days, setDays] = useState("30");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showDestination, setShowDestination] = useState(false);

  async function load() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setState("no-session");
      return;
    }
    try {
      const [nextSettings, nextOrders] = await Promise.all([
        fetchAliadoVisibilitySettings(supabase),
        fetchMyAliadoVisibilityOrders(supabase),
      ]);
      setSettings(nextSettings);
      setOrders(nextOrders);
      setDays(String(nextSettings.minDays));
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setState("no-session");
        return;
      }
      try {
        const [nextSettings, nextOrders] = await Promise.all([
          fetchAliadoVisibilitySettings(supabase),
          fetchMyAliadoVisibilityOrders(supabase),
        ]);
        if (!active) return;
        setSettings(nextSettings);
        setOrders(nextOrders);
        setDays(String(nextSettings.minDays));
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const parsedDays = /^[0-9]+$/.test(days.trim()) ? Number(days.trim()) : null;
  const validDays =
    settings && parsedDays !== null && parsedDays >= settings.minDays && parsedDays <= settings.maxDays
      ? parsedDays
      : null;
  const total = settings && validDays !== null ? validDays * settings.dailyRate : null;

  let daysError: string | null = null;
  if (settings && days.trim() !== "") {
    if (!/^[0-9]+$/.test(days.trim())) {
      daysError = "Escribe solo números enteros, sin letras ni decimales.";
    } else if (parsedDays === 0) {
      daysError = "Los días no pueden ser 0.";
    } else if (parsedDays !== null && (parsedDays < settings.minDays || parsedDays > settings.maxDays)) {
      daysError = `Elige entre ${settings.minDays} y ${settings.maxDays} días.`;
    }
  }

  async function submit() {
    if (!validDays) return;
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await createAliadoVisibilityRequest(supabase, validDays);
      setToast({
        variant: "success",
        message: "Solicitud enviada. Un administrador confirmará el pago para activarla.",
      });
      await load();
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible enviar la solicitud.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") return <FormSkeletonBody />;
  if (state === "no-session") {
    return <p className={controls.empty}>Inicia sesión con una cuenta real para ver esta sección.</p>;
  }
  if (state === "error" || !settings) {
    return <p className={controls.empty}>No fue posible cargar la información de visibilidad.</p>;
  }

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.transparencyBlock}>
          <p className={styles.transparencyTitle}>¿Quieres saber en qué se invertirá este dinero?</p>
          <button
            type="button"
            className={styles.transparencyLink}
            onClick={() => setShowDestination(true)}
            aria-haspopup="dialog"
          >
            Conoce el destino de los recursos
            <ChevronDownIcon size={16} className={styles.transparencyIcon} />
          </button>
        </div>

        <div className={styles.divider} />

        <label className={controls.field}>
          ¿Cuántos días deseas ser aliado de Huellas de Vuelta?
          <input
            className={`${controls.input} ${styles.daysInput}`}
            type="number"
            inputMode="numeric"
            min={settings.minDays}
            max={settings.maxDays}
            step={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <span className={styles.hint}>Entre {settings.minDays} y {settings.maxDays} días.</span>
        </label>
        {daysError && <p className={controls.errorText}>{daysError}</p>}

        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span>Valor por día</span>
            <strong>{formatCOP(settings.dailyRate)}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>Duración</span>
            <strong>{validDays !== null ? `${validDays} días` : "—"}</strong>
          </div>
          <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
            <span>Total</span>
            <strong>{total !== null ? formatCOP(total) : "—"}</strong>
          </div>
        </div>

        <div className={`${controls.buttonRow} ${styles.submitRow}`}>
          <button type="button" className={controls.button} disabled={!validDays || submitting} onClick={submit}>
            {submitting ? "Enviando…" : "Solicitar"}
          </button>
        </div>

        <p className={styles.note}>
          Esto no es un pago: crea una solicitud. Un administrador de Huellas de Vuelta la revisa y
          confirma el pago manualmente; tu empresa aparecerá en la red de aliados solo cuando el pago
          quede confirmado y mientras dure el período contratado.
        </p>
      </div>

      <Modal
        open={showDestination}
        title="Conoce el destino de los recursos"
        onClose={() => setShowDestination(false)}
      >
        <p className={styles.modalText}>
          Los recursos obtenidos a través de los aportes de nuestros aliados serán destinados al
          sostenimiento, desarrollo y crecimiento de Huellas de Vuelta, de acuerdo con las necesidades
          y prioridades del proyecto.
        </p>
        <p className={styles.modalText}>Entre sus principales destinos se contemplan:</p>
        <ul className={styles.modalList}>
          <li>Mantenimiento y funcionamiento de la plataforma.</li>
          <li>Capital humano cuando sea necesario para la operación y crecimiento del proyecto.</li>
          <li>Donaciones y apoyo a fundaciones.</li>
          <li>Jornadas de esterilización y cuidado de animales en sectores vulnerables.</li>
          <li>Atención y cuidado de animales en situación de calle.</li>
          <li>Banco de ayudas para animales que sufran accidentes y requieran atención para su cuidado.</li>
        </ul>
        <p className={styles.modalText}>
          Nuestro propósito es que cada aporte contribuya a fortalecer la plataforma y ampliar nuestra
          capacidad de ayudar a más animales.
        </p>
      </Modal>

      {orders.length > 0 && (
        <div className={styles.card}>
          <p className={styles.title}>Historial</p>
          <ul className={styles.orderList}>
            {orders.map((order) => (
              <li key={order.id} className={styles.orderRow}>
                <span className={`${styles.badge} ${styles[`badge_${order.computedStatus}`]}`}>
                  {STATUS_LABEL[order.computedStatus]}
                </span>
                <span className={styles.orderMeta}>
                  {order.days} días · {formatCOP(order.dailyRateApplied)}/día · {formatCOP(order.totalAmount)}
                </span>
                {order.startDate && order.endDate && (
                  <span className={styles.orderMeta}>
                    {formatDate(order.startDate)} – {formatDate(order.endDate)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
