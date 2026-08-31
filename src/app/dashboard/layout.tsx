"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import PanelShell from "@/components/panel/PanelShell";
import type { NavEntry, PanelUser } from "@/components/panel/types";
import {
  ActivityIcon,
  BellIcon,
  HomeIcon,
  PawIcon,
  ReportIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons/Icon";
import styles from "./dashboard.module.css";

const DASHBOARD_NAV: NavEntry[] = [
  { type: "link", label: "Inicio", href: "/dashboard", icon: <HomeIcon size={20} /> },
  {
    type: "group",
    label: "Mis mascotas",
    icon: <PawIcon size={19} />,
    items: [
      { label: "Mis mascotas", href: "/dashboard/mascotas" },
      { label: "Registrar mascota", href: "/dashboard/mascotas/nueva" },
      { label: "QR / Placa", href: "/dashboard/mascotas/qr" },
    ],
  },
  {
    type: "group",
    label: "Mis reportes",
    icon: <ReportIcon size={20} />,
    items: [
      { label: "Activos", href: "/dashboard/reportes/activos" },
      { label: "Historial", href: "/dashboard/reportes/historial" },
    ],
  },
  { type: "link", label: "Notificaciones", href: "/dashboard/notificaciones", icon: <BellIcon size={20} /> },
  { type: "link", label: "Mi actividad", href: "/dashboard/actividad", icon: <ActivityIcon size={20} /> },
  { type: "link", label: "Mi perfil", href: "/dashboard/perfil", icon: <UserIcon size={20} /> },
  {
    type: "group",
    label: "Configuración",
    icon: <SettingsIcon size={20} />,
    items: [
      { label: "Cuenta", href: "/dashboard/configuracion/cuenta" },
      { label: "Seguridad", href: "/dashboard/configuracion/seguridad" },
      { label: "Notificaciones", href: "/dashboard/configuracion/notificaciones" },
      { label: "Privacidad", href: "/dashboard/configuracion/privacidad" },
    ],
  },
];

// Bypass de solo-desarrollo: permite trabajar en las pantallas del panel sin
// depender de un inicio de sesión real (útil mientras el límite de correos
// de Supabase está activo). `process.env.NODE_ENV` es reemplazado en tiempo
// de compilación por Next.js: en cualquier `next build`/producción esto
// siempre es "production" y la ruta de abajo nunca se activa.
const DEV_BYPASS_ENABLED = process.env.NODE_ENV !== "production";

const DEV_USER: PanelUser = {
  id: "dev-preview",
  email: null,
  displayName: "Modo desarrollo",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
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
    <PanelShell
      user={user}
      nav={DASHBOARD_NAV}
      brandHref="/dashboard"
      brandLabel="Huellas de Vuelta"
      notificationsHref="/dashboard/notificaciones"
      menuItems={[
        { label: "Mi perfil", href: "/dashboard/perfil", icon: <UserIcon size={17} /> },
        { label: "Configuración", href: "/dashboard/configuracion/cuenta", icon: <SettingsIcon size={17} /> },
      ]}
      devBanner={
        isDevSession
          ? "Modo desarrollo: viendo el panel sin iniciar sesión real (solo visible en npm run dev, nunca en producción)."
          : undefined
      }
    >
      {children}
    </PanelShell>
  );
}
