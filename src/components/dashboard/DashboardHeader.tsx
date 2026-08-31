"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { BellIcon, ChevronDownIcon, CloseIcon, LogoutIcon, MenuIcon, SettingsIcon, UserIcon } from "@/components/icons/Icon";
import type { DashboardUser } from "./DashboardShell";
import styles from "./DashboardHeader.module.css";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function DashboardHeader({
  user,
  isNavOpen,
  onToggleNav,
}: {
  user: DashboardUser;
  isNavOpen: boolean;
  onToggleNav: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    setMenuOpen(false);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.menuToggle}
        onClick={onToggleNav}
        aria-label={isNavOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={isNavOpen}
      >
        {isNavOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
      </button>

      <Link className={styles.brand} href="/dashboard">
        <Image className={styles.logo} src="/logo.png" alt="Huellas de Vuelta" width={32} height={32} priority />
        <span className={styles.brandName}>Huellas de Vuelta</span>
      </Link>

      <div className={styles.actions}>
        <Link className={styles.notifButton} href="/dashboard/notificaciones" aria-label="Notificaciones">
          <BellIcon size={21} />
        </Link>

        <div className={styles.userMenu} ref={menuRef}>
          <button
            type="button"
            className={styles.userButton}
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className={styles.avatar} aria-hidden="true">{initialsFor(user.displayName)}</span>
            <span className={styles.userName}>{user.displayName}</span>
            <ChevronDownIcon size={14} className={`${styles.chevron} ${menuOpen ? styles.chevronOpen : ""}`} />
          </button>

          {menuOpen && (
            <div className={styles.dropdown} role="menu">
              <Link className={styles.dropdownItem} href="/dashboard/perfil" role="menuitem" onClick={() => setMenuOpen(false)}>
                <UserIcon size={17} /> Mi perfil
              </Link>
              <Link className={styles.dropdownItem} href="/dashboard/configuracion/cuenta" role="menuitem" onClick={() => setMenuOpen(false)}>
                <SettingsIcon size={17} /> Configuración
              </Link>
              <button type="button" className={styles.dropdownItem} role="menuitem" onClick={handleSignOut}>
                <LogoutIcon size={17} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
