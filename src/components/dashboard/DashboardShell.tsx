"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import DashboardHeader from "./DashboardHeader";
import Sidebar from "./Sidebar";
import styles from "./DashboardShell.module.css";

export type DashboardUser = {
  id: string;
  email: string | null;
  displayName: string;
};

export default function DashboardShell({
  user,
  isDevSession,
  children,
}: {
  user: DashboardUser;
  isDevSession: boolean;
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className={styles.shell}>
      {isDevSession && (
        <p className={styles.devBanner} role="status">
          Modo desarrollo: viendo el panel sin iniciar sesión real (solo visible en npm run dev, nunca en producción).
        </p>
      )}

      <DashboardHeader
        user={user}
        isNavOpen={mobileNavOpen}
        onToggleNav={() => setMobileNavOpen((value) => !value)}
      />

      <div className={styles.body}>
        <Sidebar isOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
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
