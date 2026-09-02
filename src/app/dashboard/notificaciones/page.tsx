"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/supabase/notifications";
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
    } catch {
      /* silencioso */
    }
  }

  const unread = items.filter((n) => !n.read_at).length;

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
          {unread > 0 && (
            <button type="button" className={styles.readAll} onClick={handleReadAll}>
              Marcar todas como leídas ({unread})
            </button>
          )}
          <ul className={styles.list}>
            {items.map((n) => (
              <li key={n.id} className={`${styles.item} ${n.read_at ? "" : styles.itemUnread}`}>
                <div className={styles.itemBody}>
                  <p className={styles.itemTitle}>{n.title}</p>
                  {n.body && <p className={styles.itemText}>{n.body}</p>}
                  <p className={styles.itemDate}>{timeAgo(n.created_at)}</p>
                </div>
                <div className={styles.itemActions}>
                  <Link className={styles.itemLink} href="/dashboard/reportes/activos">
                    Ver reporte
                  </Link>
                  {!n.read_at && (
                    <button type="button" className={styles.itemSeen} onClick={() => handleRead(n.id)}>
                      Marcar leída
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
