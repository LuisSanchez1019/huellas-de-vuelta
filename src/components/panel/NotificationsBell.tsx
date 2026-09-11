"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { countUnreadNotifications } from "@/lib/supabase/notifications";
import { onNotificationsChanged } from "@/lib/notifications/events";
import { BellIcon } from "@/components/icons/Icon";
import styles from "./NotificationsBell.module.css";

export default function NotificationsBell({ href, className }: { href: string; className?: string }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setCount(0);
        return;
      }
      countUnreadNotifications(supabase)
        .then(setCount)
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
      <span className={styles.wrap}>
        <BellIcon size={21} />
        {count > 0 && <span className={styles.badge}>{count > 9 ? "9+" : count}</span>}
      </span>
    </Link>
  );
}
