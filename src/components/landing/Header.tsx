"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "./Header.module.css";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/#mascotas", label: "Mascotas perdidas" },
  { href: "/#adopciones", label: "En adopción" },
  { href: "/#veterinarias", label: "Veterinarias" },
  { href: "/#fundaciones", label: "Fundaciones" },
  { href: "/#mapa", label: "Mapa" },
  { href: "/ayuda", label: "Ayuda" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/">
        <Image className={styles.logo} src="/logo-hdv.png" alt="Huellas de Vuelta" width={40} height={40} priority />
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
        </div>
      )}
    </header>
  );
}
