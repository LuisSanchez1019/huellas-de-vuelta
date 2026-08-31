"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  ActivityIcon,
  BellIcon,
  ChevronDownIcon,
  HomeIcon,
  LogoutIcon,
  PawIcon,
  ReportIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons/Icon";
import styles from "./Sidebar.module.css";

type NavLeaf = { label: string; href: string };
type NavLink = { type: "link"; label: string; href: string; icon: ReactNode };
type NavGroup = { type: "group"; label: string; icon: ReactNode; items: NavLeaf[] };
type NavEntry = NavLink | NavGroup;

const NAV: NavEntry[] = [
  { type: "link", label: "Inicio", href: "/dashboard", icon: <HomeIcon size={20} /> },
  {
    type: "group",
    label: "Mis mascotas",
    icon: <PawIcon size={19} />,
    items: [
      { label: "Mis mascotas", href: "/dashboard/mascotas" },
      { label: "Registrar mascota", href: "/dashboard/mascotas/nueva" },
      { label: "QR / Placa", href: "/dashboard/mascotas/qr" },
    ],
  },
  {
    type: "group",
    label: "Mis reportes",
    icon: <ReportIcon size={20} />,
    items: [
      { label: "Activos", href: "/dashboard/reportes/activos" },
      { label: "Historial", href: "/dashboard/reportes/historial" },
    ],
  },
  { type: "link", label: "Notificaciones", href: "/dashboard/notificaciones", icon: <BellIcon size={20} /> },
  { type: "link", label: "Mi actividad", href: "/dashboard/actividad", icon: <ActivityIcon size={20} /> },
  { type: "link", label: "Mi perfil", href: "/dashboard/perfil", icon: <UserIcon size={20} /> },
  {
    type: "group",
    label: "Configuración",
    icon: <SettingsIcon size={20} />,
    items: [
      { label: "Cuenta", href: "/dashboard/configuracion/cuenta" },
      { label: "Seguridad", href: "/dashboard/configuracion/seguridad" },
      { label: "Notificaciones", href: "/dashboard/configuracion/notificaciones" },
      { label: "Privacidad", href: "/dashboard/configuracion/privacidad" },
    ],
  },
];

function isGroupActive(group: NavGroup, pathname: string) {
  return group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export default function Sidebar({ isOpen, onNavigate }: { isOpen: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  // undefined = sin preferencia manual: el grupo se expande solo si contiene
  // la ruta activa. true/false = el usuario lo abrió/cerró explícitamente.
  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({});
  const [isSigningOut, setIsSigningOut] = useState(false);

  function isExpanded(entry: NavGroup) {
    const override = manualOverrides[entry.label];
    if (override !== undefined) return override;
    return isGroupActive(entry, pathname);
  }

  function toggleGroup(label: string, currentlyExpanded: boolean) {
    setManualOverrides((current) => ({ ...current, [label]: !currentlyExpanded }));
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.replace("/auth");
    }
  }

  return (
    <nav className={`${styles.sidebar} ${isOpen ? styles.open : ""}`} aria-label="Panel">
      <ul className={styles.list}>
        {NAV.map((entry) => {
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

          const expanded = isExpanded(entry);
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

      <button type="button" className={styles.signOut} onClick={handleSignOut} disabled={isSigningOut}>
        <LogoutIcon size={18} />
        {isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
    </nav>
  );
}
