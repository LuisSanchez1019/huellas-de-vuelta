"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import PanelHeader, { type PanelHeaderMenuItem } from "./PanelHeader";
import Sidebar from "./Sidebar";
import PolicyConsentGate from "@/components/legal/PolicyConsentGate";
import type { NavEntry, PanelUser } from "./types";
import styles from "./PanelShell.module.css";

export default function PanelShell({
  user,
  nav,
  brandHref,
  brandLabel,
  badge,
  notificationsHref,
  menuItems,
  signOutLabel,
  devBanner,
  signOutRedirectTo = "/",
  children,
}: {
  user: PanelUser;
  nav: NavEntry[];
  brandHref: string;
  brandLabel: string;
  badge?: string;
  notificationsHref?: string;
  menuItems?: PanelHeaderMenuItem[];
  signOutLabel?: string;
  devBanner?: ReactNode;
  signOutRedirectTo?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // El menú móvil recuerda EN QUÉ RUTA se abrió: al cambiar de ruta (enlace del menú, de la
  // cabecera, atrás/adelante) queda cerrado solo, sin efectos ni parpadeos.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const mobileNavOpen = openedAt === pathname;
  const setMobileNavOpen = (open: boolean) => setOpenedAt(open ? pathname : null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Menú abierto: Escape lo cierra (y devuelve el foco al botón), el fondo no se desplaza
  // y el foco entra al menú. Solo en móvil: en escritorio el menú siempre está a la vista.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    if (window.matchMedia("(max-width: 64rem)").matches) document.body.style.overflow = "hidden";
    document.querySelector<HTMLElement>("#panel-sidebar a, #panel-sidebar button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenedAt(null);
      document.getElementById("panel-menu-toggle")?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.replace(signOutRedirectTo);
    }
  }

  return (
    <div className={styles.shell}>
      <PolicyConsentGate onSignOut={handleSignOut} />

      {devBanner && (
        <p className={styles.devBanner} role="status">
          {devBanner}
        </p>
      )}

      <PanelHeader
        user={user}
        brandHref={brandHref}
        brandLabel={brandLabel}
        badge={badge}
        notificationsHref={notificationsHref}
        menuItems={menuItems}
        onSignOut={handleSignOut}
        isNavOpen={mobileNavOpen}
        onToggleNav={() => setMobileNavOpen(!mobileNavOpen)}
      />

      <div className={styles.body}>
        <Sidebar
          items={nav}
          isOpen={mobileNavOpen}
          onNavigate={() => setMobileNavOpen(false)}
          onSignOut={handleSignOut}
          isSigningOut={isSigningOut}
          signOutLabel={signOutLabel}
        />
        <main className={styles.content}>{children}</main>
      </div>

      {mobileNavOpen && (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Cerrar menú"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
    </div>
  );
}
