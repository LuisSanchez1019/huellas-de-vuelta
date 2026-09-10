"use client";

import type { ReactNode } from "react";
import PanelShell from "@/components/panel/PanelShell";
import { usePanelGuard, toPanelUser } from "@/components/panel/usePanelGuard";
import { HomeIcon } from "@/components/icons/Icon";
import type { NavEntry } from "@/components/panel/types";
import styles from "./aliado.module.css";

const ALIADO_NAV: NavEntry[] = [
  { type: "link", label: "Inicio", href: "/aliado", icon: <HomeIcon size={20} /> },
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
