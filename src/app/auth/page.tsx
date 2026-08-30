"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type Mode = "sign-in" | "sign-up";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("sign-up");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const displayName = String(formData.get("displayName") ?? "").trim();

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });

        if (signUpError) throw signUpError;

        setMessage(
          data.session
            ? "Tu cuenta fue creada y la sesión está lista."
            : "Revisa tu correo para confirmar la cuenta antes de iniciar sesión.",
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        setMessage("Sesión iniciada correctamente. El panel de mascotas llegará en el siguiente paso.");
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No fue posible completar la operación.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="auth-title">
        <Link className={styles.back} href="/">← Huellas de Vuelta</Link>
        <p className={styles.eyebrow}>Acceso seguro</p>
        <h1 id="auth-title">{mode === "sign-up" ? "Crea tu cuenta" : "Bienvenido de vuelta"}</h1>
        <p className={styles.description}>
          {mode === "sign-up" ? "Guarda tus datos para administrar las mascotas a tu cuidado." : "Inicia sesión para continuar con tus mascotas."}
        </p>

        <div className={styles.tabs} role="tablist" aria-label="Opciones de acceso">
          <button className={mode === "sign-up" ? styles.activeTab : styles.tab} onClick={() => setMode("sign-up")} type="button">Crear cuenta</button>
          <button className={mode === "sign-in" ? styles.activeTab : styles.tab} onClick={() => setMode("sign-in")} type="button">Iniciar sesión</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === "sign-up" && <label>Tu nombre<input name="displayName" autoComplete="name" maxLength={80} required /></label>}
          <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
          <label>Contraseña<input name="password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} required /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {message && <p className={styles.message} role="status">{message}</p>}
          <button className={styles.submit} disabled={isSubmitting} type="submit">{isSubmitting ? "Procesando…" : mode === "sign-up" ? "Crear cuenta" : "Iniciar sesión"}</button>
        </form>
      </section>
    </main>
  );
}
