"use client";

import type { ReactNode } from "react";
import PanelShell from "@/components/panel/PanelShell";
import { usePanelGuard, toPanelUser } from "@/components/panel/usePanelGuard";
import type { NavEntry } from "@/components/panel/types";
import {
  ActivityIcon,
  HandIcon,
  HomeIcon,
  IdCardIcon,
  PawIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons/Icon";
import styles from "./fundacion.module.css";

const FUNDACION_NAV: NavEntry[] = [
  { type: "link", label: "Inicio", href: "/fundacion", icon: <HomeIcon size={20} /> },
  {
    type: "group",
    label: "Mascotas",
    icon: <PawIcon size={19} />,
    items: [
      { label: "Listado", href: "/fundacion/mascotas" },
      { label: "Cargar mascotas", href: "/fundacion/mascotas/cargar" },
    ],
  },
  { type: "link", label: "Buscar hogar", href: "/fundacion/buscar-hogar", icon: <ActivityIcon size={20} /> },
  { type: "link", label: "Recepción de mascotas", href: "/fundacion/recepcion", icon: <HandIcon size={20} /> },
  { type: "link", label: "Padrinos", href: "/fundacion/padrinos", icon: <UserIcon size={20} /> },
  { type: "link", label: "Perfil de la fundación", href: "/fundacion/perfil", icon: <IdCardIcon size={20} /> },
  { type: "link", label: "Configuración", href: "/fundacion/configuracion", icon: <SettingsIcon size={20} /> },
];

export default function FundacionLayout({ children }: { children: ReactNode }) {
  const guard = usePanelGuard("fundacion");

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
      nav={FUNDACION_NAV}
      brandHref="/fundacion"
      brandLabel="Huellas de Vuelta"
      badge="Fundación"
      menuItems={[
        { label: "Perfil de la fundación", href: "/fundacion/perfil", icon: <UserIcon size={17} /> },
        { label: "Configuración", href: "/fundacion/configuracion", icon: <SettingsIcon size={17} /> },
      ]}
      devBanner={
        guard.isDev
          ? "Modo desarrollo: viendo el panel de Fundación sin iniciar sesión real (solo visible en npm run dev)."
          : undefined
      }
    >
      {children}
    </PanelShell>
  );
}
