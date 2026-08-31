"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import PanelShell from "@/components/panel/PanelShell";
import type { NavEntry, PanelUser } from "@/components/panel/types";
import { HomeIcon, UserIcon } from "@/components/icons/Icon";
import styles from "./admin.module.css";

const ADMIN_NAV: NavEntry[] = [
  { type: "link", label: "Inicio", href: "/admin", icon: <HomeIcon size={20} /> },
  { type: "link", label: "Usuarios", href: "/admin/usuarios", icon: <UserIcon size={20} /> },
];

// Mismo bypass de solo-desarrollo que usa /dashboard: nunca se activa en
// `next build`/producción (process.env.NODE_ENV siempre es "production" ahí).
//
// IMPORTANTE: todavía no existe un concepto de "rol de administrador" en la
// base de datos. Por ahora, cualquier cuenta con sesión iniciada puede
// entrar a /admin igual que a /dashboard. Antes de llevar este módulo a
// producción hay que agregar un rol de administrador (columna en
// `profiles` + políticas RLS) y validarlo aquí.
const DEV_BYPASS_ENABLED = process.env.NODE_ENV !== "production";

const DEV_ADMIN_USER: PanelUser = {
  id: "dev-admin-preview",
  email: null,
  displayName: "Admin (modo desarrollo)",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready">("checking");
  const [user, setUser] = useState<PanelUser | null>(null);
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
        setUser(DEV_ADMIN_USER);
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
    <PanelShell
      user={user}
      nav={ADMIN_NAV}
      brandHref="/admin"
      brandLabel="Huellas de Vuelta"
      badge="Administración"
      menuItems={[{ label: "Ir a mi panel", href: "/dashboard", icon: <HomeIcon size={17} /> }]}
      devBanner={
        isDevSession
          ? "Modo desarrollo: viendo el panel de administración sin iniciar sesión real ni control de rol (solo visible en npm run dev)."
          : undefined
      }
    >
      {children}
    </PanelShell>
  );
}
