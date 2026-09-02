"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { countUnreadNotifications } from "@/lib/supabase/notifications";
import { BellIcon } from "@/components/icons/Icon";
import styles from "./NotificationsBell.module.css";

export default function NotificationsBell({ href, className }: { href: string; className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      countUnreadNotifications(supabase)
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {
          /* silencioso */
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link className={className} href={href} aria-label={`Notificaciones${count > 0 ? ` (${count} sin leer)` : ""}`}>
      <span className={styles.wrap}>
        <BellIcon size={21} />
        {count > 0 && <span className={styles.badge}>{count > 9 ? "9+" : count}</span>}
      </span>
    </Link>
  );
}
