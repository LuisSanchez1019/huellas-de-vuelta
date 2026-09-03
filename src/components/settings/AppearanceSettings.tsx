"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SettingsIcon, SunIcon } from "@/components/icons/Icon";
import { useTheme, type ThemePreference } from "@/components/theme/ThemeProvider";
import styles from "./AppearanceSettings.module.css";

type Option = {
  value: ThemePreference;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const OPTIONS: Option[] = [
  {
    value: "light",
    label: "Claro",
    description: "Fondo claro en todo momento, ideal para ambientes iluminados.",
    icon: <SunIcon size={22} />,
  },
  {
    value: "dark",
    label: "Oscuro",
    description: "Fondo oscuro con contraste cuidado para descansar la vista.",
    icon: <MoonIcon size={22} />,
  },
  {
    value: "system",
    label: "Automático (según el dispositivo)",
    description: "Sigue la preferencia de tu sistema operativo y cambia con ella.",
    icon: <SettingsIcon size={22} />,
  },
];

/**
 * Panel de "Apariencia" reutilizado en Configuración de usuario, veterinaria y
 * fundación. La preferencia se guarda solo en el navegador (localStorage).
 */
export default function AppearanceSettings() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  // La preferencia real solo se conoce en el cliente (localStorage). Hasta
  // montar no marcamos ninguna opción, para que el HTML del servidor y el
  // primer render coincidan (sin error de hidratación).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Marca de "ya en cliente": es justo el propósito de este efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Apariencia</h1>
        <p className={styles.subtitle}>
          Elige cómo se ve Huellas de Vuelta en este dispositivo. La preferencia se guarda en
          este navegador.
        </p>
      </header>

      <div className={styles.options} role="radiogroup" aria-label="Tema de la interfaz">
        {OPTIONS.map((option) => {
          const selected = mounted && theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
              onClick={() => setTheme(option.value)}
            >
              <span className={styles.optionIcon} aria-hidden="true">{option.icon}</span>
              <span className={styles.optionBody}>
                <span className={styles.optionLabel}>{option.label}</span>
                <span className={styles.optionDescription}>{option.description}</span>
              </span>
              <span className={styles.optionMark} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <p className={styles.note} suppressHydrationWarning>
        {!mounted
          ? " "
          : theme === "system"
            ? `Ahora mismo se está aplicando el tema ${resolvedTheme === "dark" ? "oscuro" : "claro"} de tu sistema.`
            : "El tema seleccionado se mantiene aunque tu sistema cambie."}
      </p>
    </section>
  );
}
