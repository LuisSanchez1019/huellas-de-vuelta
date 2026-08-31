"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon, LogoutIcon } from "@/components/icons/Icon";
import { isGroupActive, type NavEntry } from "./types";
import styles from "./Sidebar.module.css";

export default function Sidebar({
  items,
  isOpen,
  onNavigate,
  onSignOut,
  isSigningOut,
  signOutLabel = "Cerrar sesión",
}: {
  items: NavEntry[];
  isOpen: boolean;
  onNavigate: () => void;
  onSignOut: () => void;
  isSigningOut: boolean;
  signOutLabel?: string;
}) {
  const pathname = usePathname();
  // undefined = sin preferencia manual: el grupo se expande solo si contiene
  // la ruta activa. true/false = el usuario lo abrió/cerró explícitamente.
  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({});

  function isExpanded(label: string, group: Extract<NavEntry, { type: "group" }>) {
    const override = manualOverrides[label];
    if (override !== undefined) return override;
    return isGroupActive(group, pathname);
  }

  function toggleGroup(label: string, currentlyExpanded: boolean) {
    setManualOverrides((current) => ({ ...current, [label]: !currentlyExpanded }));
  }

  return (
    <nav className={`${styles.sidebar} ${isOpen ? styles.open : ""}`} aria-label="Panel">
      <ul className={styles.list}>
        {items.map((entry) => {
          if (entry.type === "link") {
            const active = pathname === entry.href;
            return (
              <li key={entry.href}>
                <Link
                  className={`${styles.link} ${active ? styles.active : ""}`}
                  href={entry.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={styles.icon}>{entry.icon}</span>
                  {entry.label}
                </Link>
              </li>
            );
          }

          const expanded = isExpanded(entry.label, entry);
          const active = isGroupActive(entry, pathname);
          return (
            <li key={entry.label}>
              <button
                type="button"
                className={`${styles.groupToggle} ${active ? styles.active : ""}`}
                onClick={() => toggleGroup(entry.label, expanded)}
                aria-expanded={expanded}
              >
                <span className={styles.icon}>{entry.icon}</span>
                <span className={styles.groupLabel}>{entry.label}</span>
                <ChevronDownIcon size={15} className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`} />
              </button>
              {expanded && (
                <ul className={styles.subList}>
                  {entry.items.map((item) => {
                    const itemActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          className={`${styles.subLink} ${itemActive ? styles.active : ""}`}
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={itemActive ? "page" : undefined}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <button type="button" className={styles.signOut} onClick={onSignOut} disabled={isSigningOut}>
        <LogoutIcon size={18} />
        {isSigningOut ? "Cerrando sesión…" : signOutLabel}
      </button>
    </nav>
  );
}
