"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  deleteNotification,
  deleteNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationLink,
  type AppNotification,
} from "@/lib/supabase/notifications";
import { notifyNotificationsChanged } from "@/lib/notifications/events";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "./notificaciones.module.css";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "hace un momento";
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

export default function NotificacionesPage() {
  const [state, setState] = useState<"loading" | "ready" | "no-session" | "error">("loading");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setState("no-session");
        return;
      }
      try {
        setItems(await fetchNotifications(supabase));
        setSelected(new Set());
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRead(id: string) {
    const supabase = createSupabaseBrowserClient();
    try {
      await markNotificationRead(supabase, id);
      setItems((current) =>
        current.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      notifyNotificationsChanged();
    } catch {
      /* silencioso */
    }
  }

  async function handleReadAll() {
    const supabase = createSupabaseBrowserClient();
    try {
      await markAllNotificationsRead(supabase);
      const now = new Date().toISOString();
      setItems((current) => current.map((n) => (n.read_at ? n : { ...n, read_at: now })));
      notifyNotificationsChanged();
    } catch {
      /* silencioso */
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await deleteNotification(createSupabaseBrowserClient(), id);
      setItems((current) => current.filter((n) => n.id !== id));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      notifyNotificationsChanged();
    } catch {
      setToast({ variant: "error", message: "No fue posible eliminar la notificación." });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await deleteNotifications(createSupabaseBrowserClient(), ids);
      setItems((current) => current.filter((n) => !selected.has(n.id)));
      setSelected(new Set());
      setConfirmBulk(false);
      notifyNotificationsChanged();
      setToast({
        variant: "success",
        message: ids.length === 1 ? "Notificación eliminada." : `${ids.length} notificaciones eliminadas.`,
      });
    } catch {
      setToast({ variant: "error", message: "No fue posible eliminar las notificaciones." });
    } finally {
      setBusy(false);
    }
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => (current.size === items.length ? new Set() : new Set(items.map((n) => n.id))));
  }

  const unread = useMemo(() => items.filter((n) => !n.read_at).length, [items]);
  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Notificaciones</h1>
        <p className={controls.pageSubtitle}>
          Avisos sobre tus mascotas perdidas: avistamientos y personas que las encontraron.
        </p>
      </div>

      {state === "loading" && <p className={controls.loading}>Cargando…</p>}
      {state === "no-session" && (
        <p className={controls.empty}>Inicia sesión con una cuenta real para ver tus notificaciones.</p>
      )}
      {state === "error" && <p className={controls.empty}>No fue posible cargar las notificaciones.</p>}

      {state === "ready" && items.length === 0 && (
        <p className={controls.empty}>No tienes notificaciones por ahora.</p>
      )}

      {state === "ready" && items.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <label className={styles.selectAll}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todas" />
              {selected.size > 0 ? `${selected.size} seleccionadas` : "Seleccionar todas"}
            </label>

            <div className={styles.toolbarActions}>
              {unread > 0 && (
                <button type="button" className={styles.readAll} onClick={handleReadAll}>
                  Marcar todas como leídas ({unread})
                </button>
              )}
              {selected.size > 0 && (
                <button
                  type="button"
                  className={styles.deleteSelected}
                  disabled={busy}
                  onClick={() => setConfirmBulk(true)}
                >
                  Eliminar seleccionadas ({selected.size})
                </button>
              )}
            </div>
          </div>

          <ul className={styles.list}>
            {items.map((n) => (
              <li key={n.id} className={`${styles.item} ${n.read_at ? "" : styles.itemUnread}`}>
                <input
                  type="checkbox"
                  className={styles.itemCheck}
                  checked={selected.has(n.id)}
                  onChange={() => toggleOne(n.id)}
                  aria-label={`Seleccionar «${n.title}»`}
                />
                <div className={styles.itemBody}>
                  <p className={styles.itemTitle}>{n.title}</p>
                  {n.body && <p className={styles.itemText}>{n.body}</p>}
                  <p className={styles.itemDate}>{timeAgo(n.created_at)}</p>
                </div>
                <div className={styles.itemActions}>
                  {notificationLink(n.type) && (
                    <Link className={styles.itemLink} href={notificationLink(n.type) as string}>
                      {n.type.startsWith("admin_") ? "Abrir" : "Ver reporte"}
                    </Link>
                  )}
                  {!n.read_at && (
                    <button type="button" className={styles.itemSeen} onClick={() => handleRead(n.id)}>
                      Marcar leída
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.itemDelete}
                    disabled={busy}
                    onClick={() => handleDelete(n.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={confirmBulk}
        title="Eliminar notificaciones"
        message={
          selected.size === 1
            ? "Se eliminará la notificación seleccionada. Esta acción no se puede deshacer."
            : `Se eliminarán ${selected.size} notificaciones. Esta acción no se puede deshacer.`
        }
        confirmLabel={busy ? "Eliminando…" : "Sí, eliminar"}
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={handleDeleteSelected}
        onCancel={() => setConfirmBulk(false)}
      />

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
