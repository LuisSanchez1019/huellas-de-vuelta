"use client";

import { MoonIcon, SunIcon } from "@/components/icons/Icon";
import { useTheme } from "./ThemeProvider";
import styles from "./ThemeToggle.module.css";

/**
 * Botón compacto para cabeceras: alterna entre modo claro y oscuro.
 *
 * Los dos iconos se renderizan siempre y es el CSS (leyendo `data-theme` /
 * `prefers-color-scheme`) quien muestra el que toca. Así el HTML del servidor y
 * el del primer render en cliente son idénticos aunque haya una preferencia
 * guardada distinta al valor por defecto: no hay error de hidratación ni
 * parpadeo del icono. El `aria-label` sí depende del estado (correcto tras
 * hidratar); `suppressHydrationWarning` absorbe esa única diferencia.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className={`${styles.toggle} ${className ?? ""}`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      suppressHydrationWarning
    >
      <MoonIcon size={18} className={styles.iconLight} />
      <SunIcon size={18} className={styles.iconDark} />
    </button>
  );
}
