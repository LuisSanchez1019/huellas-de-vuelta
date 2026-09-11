"use client";

import type { ReactNode } from "react";
import PanelShell from "@/components/panel/PanelShell";
import { usePanelGuard, toPanelUser } from "@/components/panel/usePanelGuard";
import { useIsAdmin } from "@/components/panel/useIsAdmin";
import { buildPanelNav } from "@/components/panel/nav";
import { LockIcon, UserIcon } from "@/components/icons/Icon";
import styles from "./dashboard.module.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const guard = usePanelGuard("usuario");
  const isAdmin = useIsAdmin();

  if (guard.status !== "ready") {
    return (
      <main className={styles.checking}>
        <p>Verificando tu sesión…</p>
      </main>
    );
  }

  return (
    <PanelShell
      user={toPanelUser(guard.session)}
      nav={buildPanelNav({ isAdmin })}
      brandHref="/dashboard"
      brandLabel="Huellas de Vuelta"
      notificationsHref="/dashboard/notificaciones"
      menuItems={[
        { label: "Mi perfil", href: "/dashboard/perfil", icon: <UserIcon size={17} /> },
        { label: "Privacidad", href: "/dashboard/configuracion/privacidad", icon: <LockIcon size={17} /> },
      ]}
      devBanner={
        guard.isDev
          ? "Modo desarrollo: viendo el panel de Usuario sin iniciar sesión real (solo visible en npm run dev, nunca en producción)."
          : undefined
      }
    >
      {children}
    </PanelShell>
  );
}
