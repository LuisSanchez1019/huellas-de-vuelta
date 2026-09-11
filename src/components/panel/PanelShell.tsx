"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
        onToggleNav={() => setMobileNavOpen((value) => !value)}
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
