"use client";

import type { ReactNode } from "react";
import PanelShell from "@/components/panel/PanelShell";
import { usePanelGuard, toPanelUser } from "@/components/panel/usePanelGuard";
import type { NavEntry } from "@/components/panel/types";
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
      { label: "Registrar mascota", href: "/dashboard/mascotas/nueva" },
      { label: "Mis mascotas", href: "/dashboard/mascotas" },
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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const guard = usePanelGuard("usuario");

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
      nav={DASHBOARD_NAV}
      brandHref="/dashboard"
      brandLabel="Huellas de Vuelta"
      notificationsHref="/dashboard/notificaciones"
      menuItems={[
        { label: "Mi perfil", href: "/dashboard/perfil", icon: <UserIcon size={17} /> },
        { label: "Configuración", href: "/dashboard/configuracion/cuenta", icon: <SettingsIcon size={17} /> },
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
