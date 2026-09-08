"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ACCOUNT_ROLES, roleHome, roleLabels } from "@/lib/auth/roles";
import { setDevRole } from "@/lib/auth/session";
import { ChevronDownIcon } from "@/components/icons/Icon";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "./Header.module.css";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/#mascotas", label: "Mascotas perdidas" },
  { href: "/#adopciones", label: "En adopción" },
  { href: "/#aliados", label: "Aliados" },
  { href: "/#mapa", label: "Mapa" },
  { href: "/ayuda", label: "Ayuda" },
];

// Acceso directo a cada panel sin iniciar sesión, solo para desarrollo. Next.js
// reemplaza process.env.NODE_ENV en tiempo de compilación: en cualquier
// `next build`/producción esto es "production" y el menú no se renderiza.
const DEV_ACCESS = process.env.NODE_ENV !== "production";

export default function Header() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [devMenuOpen, setDevMenuOpen] = useState(false);

  function enterPanelAsDev(role: (typeof ACCOUNT_ROLES)[number]) {
    setDevRole(role);
    setDevMenuOpen(false);
    setMenuOpen(false);
    router.push(roleHome[role]);
  }

  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/">
        <Image className={styles.logo} src="/logo.png" alt="Huellas de Vuelta" width={40} height={40} priority />
        <span className={styles.brandText}>
          <span className={styles.brandName}>Huellas de Vuelta</span>
          <span className={styles.brandTagline}>Conectando corazones</span>
        </span>
      </Link>

      <nav className={styles.nav} aria-label="Principal">
        {navItems.map((item) => (
          <Link key={item.label} className={styles.navLink} href={item.href}>{item.label}</Link>
        ))}
      </nav>

      <div className={styles.actions}>
        <ThemeToggle />
        {DEV_ACCESS && (
          <div className={styles.devMenu}>
            <button
              type="button"
              className={styles.devAccess}
              onClick={() => setDevMenuOpen((value) => !value)}
              aria-expanded={devMenuOpen}
              title="Solo desarrollo: entra a un panel sin login"
            >
              Panel (dev) <ChevronDownIcon size={14} />
            </button>
            {devMenuOpen && (
              <div className={styles.devMenuPanel} role="menu">
                {ACCOUNT_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={styles.devMenuItem}
                    role="menuitem"
                    onClick={() => enterPanelAsDev(role)}
                  >
                    {roleLabels[role]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Link className={styles.signIn} href="/auth?mode=sign-in">Iniciar sesión</Link>
        <Link className={styles.signUp} href="/auth?mode=sign-up">Regístrate</Link>
        <button
          className={styles.menuToggle}
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className={`${styles.mobilePanel} ${styles.open}`}>
          {navItems.map((item) => (
            <Link key={item.label} className={styles.navLink} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>
          ))}
          {DEV_ACCESS &&
            ACCOUNT_ROLES.map((role) => (
              <button key={role} type="button" className={styles.devAccess} onClick={() => enterPanelAsDev(role)}>
                Panel {roleLabels[role]} (dev)
              </button>
            ))}
          <div className={styles.mobileCtas}>
            <Link className={styles.signIn} href="/auth?mode=sign-in" onClick={() => setMenuOpen(false)}>Iniciar sesión</Link>
            <Link className={styles.signUp} href="/auth?mode=sign-up" onClick={() => setMenuOpen(false)}>Regístrate</Link>
          </div>
          <div className={styles.mobileTheme}>
            <span>Tema</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}
