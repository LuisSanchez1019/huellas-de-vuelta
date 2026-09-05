"use client";

import type { ReactNode } from "react";
import PanelShell from "@/components/panel/PanelShell";
import { usePanelGuard, toPanelUser } from "@/components/panel/usePanelGuard";
import type { NavEntry } from "@/components/panel/types";
import { HandIcon, HomeIcon, IdCardIcon, PawIcon, SettingsIcon, UserIcon } from "@/components/icons/Icon";
import styles from "./veterinaria.module.css";

const VETERINARIA_NAV: NavEntry[] = [
  { type: "link", label: "Inicio", href: "/veterinaria", icon: <HomeIcon size={20} /> },
  {
    type: "group",
    label: "Mascotas",
    icon: <PawIcon size={19} />,
    items: [
      { label: "Listado", href: "/veterinaria/mascotas" },
      { label: "Cargar mascotas", href: "/veterinaria/mascotas/cargar" },
    ],
  },
  { type: "link", label: "Recepción de mascotas", href: "/veterinaria/recepcion", icon: <HandIcon size={20} /> },
  { type: "link", label: "Crear perfil", href: "/veterinaria/perfil/crear", icon: <IdCardIcon size={20} /> },
  { type: "link", label: "Mi perfil", href: "/veterinaria/perfil", icon: <UserIcon size={20} /> },
  { type: "link", label: "Configuración", href: "/veterinaria/configuracion", icon: <SettingsIcon size={20} /> },
];

export default function VeterinariaLayout({ children }: { children: ReactNode }) {
  const guard = usePanelGuard("veterinaria");

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
      nav={VETERINARIA_NAV}
      brandHref="/veterinaria"
      brandLabel="Huellas de Vuelta"
      badge="Veterinaria"
      menuItems={[
        { label: "Mi perfil", href: "/veterinaria/perfil", icon: <UserIcon size={17} /> },
        { label: "Configuración", href: "/veterinaria/configuracion", icon: <SettingsIcon size={17} /> },
      ]}
      devBanner={
        guard.isDev
          ? "Modo desarrollo: viendo el panel de Veterinaria sin iniciar sesión real (solo visible en npm run dev)."
          : undefined
      }
    >
      {children}
    </PanelShell>
  );
}
