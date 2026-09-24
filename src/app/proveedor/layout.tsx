"use client";

import type { ReactNode } from "react";
import PanelShell from "@/components/panel/PanelShell";
import { usePanelGuard, toPanelUser } from "@/components/panel/usePanelGuard";
import PanelGuardError from "@/components/panel/PanelGuardError";
import { HomeIcon, IdCardIcon, QrIcon, ShieldIcon, UserIcon } from "@/components/icons/Icon";
import type { NavEntry } from "@/components/panel/types";
import styles from "./proveedor.module.css";

const PROVEEDOR_NAV: NavEntry[] = [
  { type: "link", label: "Inicio", href: "/proveedor", icon: <HomeIcon size={20} /> },
  { type: "link", label: "Códigos QR", href: "/proveedor/qr", icon: <QrIcon size={20} /> },
  { type: "link", label: "Perfil de la empresa", href: "/proveedor/perfil", icon: <IdCardIcon size={20} /> },
  { type: "link", label: "Mi perfil", href: "/proveedor/mi-perfil", icon: <UserIcon size={20} /> },
  { type: "link", label: "Seguridad y privacidad", href: "/proveedor/configuracion/seguridad", icon: <ShieldIcon size={19} /> },
];

export default function ProveedorLayout({ children }: { children: ReactNode }) {
  const guard = usePanelGuard("proveedor");

  if (guard.status === "error") {
    return <PanelGuardError onRetry={guard.retry} />;
  }

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
      nav={PROVEEDOR_NAV}
      brandHref="/proveedor"
      brandLabel="Huellas de Vuelta"
      badge="Proveedor"
      menuItems={[
        { label: "Mi perfil", href: "/proveedor/mi-perfil", icon: <UserIcon size={17} /> },
        { label: "Seguridad y privacidad", href: "/proveedor/configuracion/seguridad", icon: <ShieldIcon size={17} /> },
      ]}
      devBanner={
        guard.isDev
          ? "Modo desarrollo: viendo el panel de Proveedor sin iniciar sesión real (solo visible en npm run dev)."
          : undefined
      }
    >
      {children}
    </PanelShell>
  );
}
