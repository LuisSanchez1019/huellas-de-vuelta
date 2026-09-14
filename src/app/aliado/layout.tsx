"use client";

import type { ReactNode } from "react";
import PanelShell from "@/components/panel/PanelShell";
import { usePanelGuard, toPanelUser } from "@/components/panel/usePanelGuard";
import { HandIcon, HeartIcon, HomeIcon, IdCardIcon, PawIcon, PinIcon, ShieldIcon, UserIcon } from "@/components/icons/Icon";
import type { NavEntry } from "@/components/panel/types";
import styles from "./aliado.module.css";

const ALIADO_NAV: NavEntry[] = [
  { type: "link", label: "Inicio", href: "/aliado", icon: <HomeIcon size={20} /> },
  {
    type: "group",
    label: "Mascotas",
    icon: <PawIcon size={19} />,
    items: [
      { label: "Registrar mascota", href: "/aliado/mascotas/nueva" },
      { label: "Mis mascotas", href: "/aliado/mascotas" },
    ],
  },
  { type: "link", label: "Apadrina una mascota", href: "/aliado/apadrina", icon: <HandIcon size={20} /> },
  { type: "link", label: "Mascotas perdidas", href: "/aliado/mascotas-perdidas", icon: <PinIcon size={20} /> },
  { type: "link", label: "Perfil de la empresa", href: "/aliado/perfil", icon: <IdCardIcon size={20} /> },
  { type: "link", label: "Apoya a Huellas de Vuelta", href: "/aliado/visibilidad", icon: <HeartIcon size={20} /> },
  { type: "link", label: "Mi perfil", href: "/aliado/mi-perfil", icon: <UserIcon size={20} /> },
  { type: "link", label: "Seguridad y privacidad", href: "/aliado/configuracion/seguridad", icon: <ShieldIcon size={19} /> },
];

export default function AliadoLayout({ children }: { children: ReactNode }) {
  const guard = usePanelGuard("aliado");

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
      nav={ALIADO_NAV}
      brandHref="/aliado"
      brandLabel="Huellas de Vuelta"
      badge="Aliado"
      menuItems={[
        { label: "Mi perfil", href: "/aliado/mi-perfil", icon: <UserIcon size={17} /> },
        { label: "Seguridad y privacidad", href: "/aliado/configuracion/seguridad", icon: <ShieldIcon size={17} /> },
      ]}
      devBanner={
        guard.isDev
          ? "Modo desarrollo: viendo el panel de Aliado sin iniciar sesión real (solo visible en npm run dev)."
          : undefined
      }
    >
      {children}
    </PanelShell>
  );
}
