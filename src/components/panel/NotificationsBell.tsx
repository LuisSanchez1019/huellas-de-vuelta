"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { countUnreadNotifications } from "@/lib/supabase/notifications";
import { onNotificationsChanged } from "@/lib/notifications/events";
import { BellIcon } from "@/components/icons/Icon";
import styles from "./NotificationsBell.module.css";

export default function NotificationsBell({ href, className }: { href: string; className?: string }) {
  const [count, setCount] = useState(0);
  const [justArrived, setJustArrived] = useState(false);
  // null = todavía no se conoce un valor previo (primera carga): nunca debe
  // animar solo porque ya había no leídas al entrar, solo cuando el número
  // sube durante la sesión ya montada (una notificación nueva de verdad).
  const previousCountRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        previousCountRef.current = 0;
        setCount(0);
        return;
      }
      countUnreadNotifications(supabase)
        .then((next) => {
          const previous = previousCountRef.current;
          if (previous !== null && next > previous) setJustArrived(true);
          previousCountRef.current = next;
          setCount(next);
        })
        .catch(() => {
          /* silencioso */
        });
    });
  }, []);

  useEffect(() => {
    refresh();
    // Se actualiza cuando la página de notificaciones cambia la lista, y también
    // al volver a la pestaña (por si otra sesión la modificó).
    const offChanged = onNotificationsChanged(refresh);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      offChanged();
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return (
    <Link className={className} href={href} aria-label={`Notificaciones${count > 0 ? ` (${count} sin leer)` : ""}`}>
      <span
        className={`${styles.wrap} ${justArrived ? styles.ring : ""}`}
        onAnimationEnd={(e) => {
          if (e.animationName === "hdvBellRing") setJustArrived(false);
        }}
      >
        <BellIcon size={21} />
        {count > 0 && <span className={styles.badge}>{count > 9 ? "9+" : count}</span>}
      </span>
    </Link>
  );
}
