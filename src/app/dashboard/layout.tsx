"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import DashboardShell from "@/components/dashboard/DashboardShell";
import type { DashboardUser } from "@/components/dashboard/DashboardShell";
import styles from "./dashboard.module.css";

// Bypass de solo-desarrollo: permite trabajar en las pantallas del panel sin
// depender de un inicio de sesión real (útil mientras el límite de correos
// de Supabase está activo). `process.env.NODE_ENV` es reemplazado en tiempo
// de compilación por Next.js: en cualquier `next build`/producción esto
// siempre es "production" y la ruta de abajo nunca se activa.
const DEV_BYPASS_ENABLED = process.env.NODE_ENV !== "production";

const DEV_USER: DashboardUser = {
  id: "dev-preview",
  email: null,
  displayName: "Modo desarrollo",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready">("checking");
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [isDevSession, setIsDevSession] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;

      if (session) {
        const metadataName = session.user.user_metadata?.display_name;
        setUser({
          id: session.user.id,
          email: session.user.email ?? null,
          displayName: (typeof metadataName === "string" && metadataName.trim()) || session.user.email || "Tu cuenta",
        });
        setIsDevSession(false);
        setStatus("ready");
        return;
      }

      if (DEV_BYPASS_ENABLED) {
        setUser(DEV_USER);
        setIsDevSession(true);
        setStatus("ready");
        return;
      }

      router.replace("/auth");
    });
  }, [router]);

  if (status !== "ready" || !user) {
    return (
      <main className={styles.checking}>
        <p>Verificando tu sesión…</p>
      </main>
    );
  }

  return (
    <DashboardShell user={user} isDevSession={isDevSession}>
      {children}
    </DashboardShell>
  );
}
