"use client";

import type { ReactNode } from "react";
import { useAdminGuard } from "@/components/panel/useAdminGuard";
import PanelShell from "@/components/panel/PanelShell";
import { buildPanelNav } from "@/components/panel/nav";
import { ShieldIcon, UserIcon } from "@/components/icons/Icon";
import styles from "./admin.module.css";

/**
 * Las rutas /admin usan el MISMO panel que el Dashboard normal (misma cabecera,
 * misma barra lateral, mismas opciones de usuario). La única diferencia es que
 * aquí la sección "Administración" del menú está siempre presente y activa.
 * El acceso está protegido por `useAdminGuard` (redirige a /dashboard) y, sobre
 * todo, por Supabase (RLS + funciones SECURITY DEFINER que exigen is_admin).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const guard = useAdminGuard();

  if (guard.status !== "ready") {
    return (
      <main className={styles.checking}>
        <p>Verificando tu sesión…</p>
      </main>
    );
  }

  return (
    <PanelShell
      user={{
        id: guard.session.userId,
        email: guard.session.email,
        displayName: guard.session.displayName,
        role: guard.session.role,
      }}
      nav={buildPanelNav({ isAdmin: true })}
      brandHref="/dashboard"
      brandLabel="Huellas de Vuelta"
      notificationsHref="/dashboard/notificaciones"
      menuItems={[
        { label: "Mi perfil", href: "/dashboard/perfil", icon: <UserIcon size={17} /> },
        { label: "Seguridad y privacidad", href: "/dashboard/configuracion/seguridad", icon: <ShieldIcon size={17} /> },
      ]}
    >
      {children}
    </PanelShell>
  );
}
