"use client";

import type { FormEvent } from "react";
import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { translateAuthError } from "@/lib/supabase/errors";
import { resolvePanelSession } from "@/lib/auth/session";
import { ACCOUNT_ROLES, isAccountRole, roleHome, roleLabels, type AccountRole } from "@/lib/auth/roles";
import { CheckIcon } from "@/components/icons/Icon";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "./page.module.css";

type Mode = "sign-in" | "sign-up";

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.4 4.7A10.9 10.9 0 0 1 12 4.5c5 0 9 4 10.5 7.5-.6 1.4-1.5 2.8-2.7 4M6.2 6.2C4 7.7 2.4 9.7 1.5 12c1.5 3.5 5.5 7.5 10.5 7.5 1.3 0 2.5-.2 3.6-.6" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const ROLE_HINT: Record<AccountRole, string> = {
  usuario: "Administra las mascotas a tu cuidado y genera sus placas QR.",
  fundacion: "Gestiona las mascotas de tu fundación, carga masiva y búsqueda de hogar.",
  veterinaria: "Registra mascotas y publica el perfil de tu veterinaria.",
};

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode: Mode = searchParams.get("mode") === "sign-in" ? "sign-in" : "sign-up";
  const roleParam = searchParams.get("role");
  const initialRole: AccountRole = isAccountRole(roleParam) ? roleParam : "usuario";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<AccountRole>(initialRole);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function resetFeedback() {
    setError(null);
    setMessage(null);
  }

  function handleModeChange(nextMode: Mode) {
    setMode(nextMode);
    resetFeedback();
  }

  async function goToRoleHome() {
    // El panel real siempre se decide por el rol de la cuenta autenticada.
    const check = await resolvePanelSession();
    const target =
      check.status === "unauthenticated" ? roleHome[role] : roleHome[check.session.role];
    router.push(target);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    resetFeedback();

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const displayName = `${firstName} ${lastName}`.trim();

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (mode === "sign-up") {
      const confirmPassword = String(formData.get("confirmPassword") ?? "");
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              first_name: firstName,
              last_name: lastName,
              role,
            },
            emailRedirectTo: window.location.origin,
          },
        });

        if (signUpError) throw signUpError;

        form.reset();
        setShowPassword(false);
        setShowConfirmPassword(false);

        if (data.session) {
          await goToRoleHome();
        } else {
          setMessage("Revisa tu correo para confirmar la cuenta antes de iniciar sesión.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        form.reset();
        setShowPassword(false);
        await goToRoleHome();
      }
    } catch (caughtError) {
      setError(translateAuthError(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.themeSlot}>
        <ThemeToggle />
      </div>

      <div className={styles.shell}>
        <aside className={styles.brandPanel}>
          <Link className={styles.brandBack} href="/">← Volver al inicio</Link>
          <div className={styles.brandMain}>
            <Image className={styles.brandLogo} src="/logo-emblem.png" alt="Huellas de Vuelta" width={797} height={805} priority />
            <p className={styles.brandName}>Huellas de Vuelta</p>
            <p className={styles.brandTagline}>Ayudamos a que cada mascota vuelva a casa.</p>
            <ul className={styles.brandPoints}>
              <li><CheckIcon size={18} /> Placas QR que conectan a quien encuentra con la familia.</li>
              <li><CheckIcon size={18} /> Reportes de mascotas perdidas y encontradas.</li>
              <li><CheckIcon size={18} /> {ROLE_HINT[role]}</li>
            </ul>
          </div>
          <p className={styles.brandFoot}>Acceso seguro · Tus datos están protegidos.</p>
        </aside>

        <section className={styles.card} aria-labelledby="auth-title">
        <p className={styles.eyebrow}>{mode === "sign-up" ? "Nueva cuenta" : "Acceso"}</p>
        <h1 id="auth-title">{mode === "sign-up" ? "Crea tu cuenta" : "Bienvenido de vuelta"}</h1>
        <p className={styles.description}>{ROLE_HINT[role]}</p>

        <div className={styles.tabs} role="tablist" aria-label="Opciones de acceso">
          <button className={mode === "sign-up" ? styles.activeTab : styles.tab} onClick={() => handleModeChange("sign-up")} type="button">Crear cuenta</button>
          <button className={mode === "sign-in" ? styles.activeTab : styles.tab} onClick={() => handleModeChange("sign-in")} type="button">Iniciar sesión</button>
        </div>

        <div className={`${styles.tabs} ${styles.roleTabs}`} role="tablist" aria-label="Tipo de cuenta">
          {ACCOUNT_ROLES.map((value) => (
            <button
              key={value}
              type="button"
              className={role === value ? styles.activeTab : styles.tab}
              aria-pressed={role === value}
              onClick={() => {
                setRole(value);
                resetFeedback();
              }}
            >
              {roleLabels[value]}
            </button>
          ))}
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === "sign-up" && (
            <div className={styles.nameRow}>
              <label>Nombre<input name="firstName" autoComplete="given-name" maxLength={60} required /></label>
              <label>Apellido<input name="lastName" autoComplete="family-name" maxLength={60} required /></label>
            </div>
          )}
          <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>

          <label>
            Contraseña
            <div className={styles.passwordField}>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                minLength={8}
                required
              />
              <button
                className={styles.toggleVisibility}
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
              >
                <EyeIcon hidden={showPassword} />
              </button>
            </div>
          </label>

          {mode === "sign-in" && (
            <div className={styles.forgotRow}>
              <Link className={styles.forgotLink} href="/auth/recuperar">¿Olvidaste tu contraseña?</Link>
            </div>
          )}

          {mode === "sign-up" && (
            <label>
              Confirmar contraseña
              <div className={styles.passwordField}>
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  className={styles.toggleVisibility}
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showConfirmPassword}
                >
                  <EyeIcon hidden={showConfirmPassword} />
                </button>
              </div>
            </label>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}
          {message && <p className={styles.message} role="status">{message}</p>}
          <button className={styles.submit} disabled={isSubmitting} type="submit">{isSubmitting ? "Procesando…" : mode === "sign-up" ? "Crear cuenta" : "Iniciar sesión"}</button>
        </form>

        <p className={styles.switchLine}>
          {mode === "sign-up" ? "¿Ya tienes cuenta? " : "¿No tienes una cuenta? "}
          <button
            type="button"
            className={styles.switchButton}
            onClick={() => handleModeChange(mode === "sign-up" ? "sign-in" : "sign-up")}
          >
            {mode === "sign-up" ? "Inicia sesión" : "Crear cuenta"}
          </button>
        </p>
        </section>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}
