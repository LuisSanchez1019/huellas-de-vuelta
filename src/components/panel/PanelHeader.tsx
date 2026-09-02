"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDownIcon, CloseIcon, LogoutIcon, MenuIcon } from "@/components/icons/Icon";
import NotificationsBell from "./NotificationsBell";
import type { PanelUser } from "./types";
import styles from "./PanelHeader.module.css";

export type PanelHeaderMenuItem = { label: string; href: string; icon: ReactNode };

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function PanelHeader({
  user,
  brandHref,
  brandLabel,
  badge,
  notificationsHref,
  menuItems = [],
  onSignOut,
  isNavOpen,
  onToggleNav,
}: {
  user: PanelUser;
  brandHref: string;
  brandLabel: string;
  badge?: string;
  notificationsHref?: string;
  menuItems?: PanelHeaderMenuItem[];
  onSignOut: () => void;
  isNavOpen: boolean;
  onToggleNav: () => void;
}) {
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

      <Link className={styles.brand} href={brandHref}>
        <Image className={styles.logo} src="/logo.png" alt="Huellas de Vuelta" width={32} height={32} priority />
        <span className={styles.brandName}>{brandLabel}</span>
        {badge && <span className={styles.badge}>{badge}</span>}
      </Link>

      <div className={styles.actions}>
        {notificationsHref && (
          <NotificationsBell href={notificationsHref} className={styles.notifButton} />
        )}

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
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  className={styles.dropdownItem}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.icon} {item.label}
                </Link>
              ))}
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
              >
                <LogoutIcon size={17} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
