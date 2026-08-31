"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Header.module.css";

const navItems = [
  { href: "#mascotas", label: "Mascotas" },
  { href: "#adopciones", label: "Adopciones" },
  { href: "#aliados", label: "Aliados" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "/mapa", label: "Mapa" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/">
        <Image className={styles.logo} src="/logo.png" alt="Huellas de Vuelta" width={36} height={36} priority />
        <span>Huellas de Vuelta</span>
      </Link>

      <nav className={styles.nav} aria-label="Principal">
        {navItems.map((item) => (
          <Link key={item.href} className={styles.navLink} href={item.href}>{item.label}</Link>
        ))}
      </nav>

      <div className={styles.actions}>
        <Link className={styles.signIn} href="/auth?mode=sign-in">Iniciar sesión</Link>
        <Link className={styles.signUp} href="/auth?mode=sign-up">Registrarse</Link>
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
            <Link key={item.href} className={styles.navLink} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>
          ))}
          <Link className={styles.signIn} href="/auth?mode=sign-in" onClick={() => setMenuOpen(false)}>Iniciar sesión</Link>
        </div>
      )}
    </header>
  );
}
