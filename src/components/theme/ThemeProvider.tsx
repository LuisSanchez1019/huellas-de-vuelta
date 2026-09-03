"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "hdv-theme";

interface ThemeContextValue {
  /** Preferencia elegida por la persona. */
  theme: ThemePreference;
  /** Tema efectivo aplicado ahora mismo. */
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Evita el aviso de React por usar useLayoutEffect durante el render en servidor.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function readStored(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Escribe (o quita) el atributo `data-theme` del <html>, que es lo que leen los tokens de CSS. */
function syncThemeAttr(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (preference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preference);
  }
}

/**
 * Cambia el tema en caliente. Añade `theme-switching` para desactivar TODAS las
 * transiciones mientras dura el cambio: además de evitar el "flash" del fundido,
 * sortea un fallo de Chromium por el que un elemento con `transition` sobre una
 * propiedad que sale de `var()` no se repinta cuando esa variable cambia en un
 * ancestro.
 */
function applyThemeChange(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-switching");
  syncThemeAttr(preference);
  // Fuerza el recálculo de estilos con las transiciones ya desactivadas.
  void root.offsetHeight;
  window.requestAnimationFrame(() => {
    root.classList.remove("theme-switching");
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Inicialización perezosa: en el servidor devuelve valores neutros; en el
  // cliente lee la preferencia guardada. El <script> del layout ya pintó el
  // tema correcto sin parpadeo, así que esto solo alimenta el contexto/toggle.
  const [theme, setThemeState] = useState<ThemePreference>(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Reafirma el atributo antes del pintado. En producción es un no-op (el script
  // del <head> ya lo puso); en desarrollo, React (Strict Mode) reinicia los
  // atributos de <html> en el remonte y hay que volver a aplicarlo.
  useIsomorphicLayoutEffect(() => {
    syncThemeAttr(theme);
  }, [theme]);

  // Cambios del tema del sistema, relevantes solo cuando la preferencia es "system".
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* almacenamiento no disponible */
    }
    applyThemeChange(next);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Mantiene sincronizado `color-scheme` (formularios/scrollbars nativos) con el tema efectivo.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.colorScheme = resolvedTheme;
    }
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback seguro si algún componente se monta fuera del provider.
    return {
      theme: "system",
      resolvedTheme: "light",
      setTheme: () => {},
    };
  }
  return ctx;
}

/** Script bloqueante para el <head>: fija el tema antes del primer render. */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=p==='light'||p==='dark'?p:(d?'dark':'light');var r=document.documentElement;if(p==='light'||p==='dark'){r.setAttribute('data-theme',p);}r.style.colorScheme=t;}catch(e){}})();`;
