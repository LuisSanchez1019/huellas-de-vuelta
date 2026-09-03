"use client";

import { type FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { translateAuthError } from "@/lib/supabase/errors";
import styles from "../page.module.css";

export default function RecuperarPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setMessage(null);

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();

    if (!email) {
      setError("Ingresa tu correo electrónico.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/restablecer`,
      });
      if (resetError) throw resetError;
      form.reset();
      setMessage("Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña. Revisa tu bandeja de entrada y la carpeta de spam.");
    } catch (caughtError) {
      setError(translateAuthError(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="recover-title">
        <Link className={styles.back} href="/auth?mode=sign-in">← Volver a iniciar sesión</Link>

        <div className={styles.logoWrap}>
          <Image className={styles.logo} src="/logo-emblem.png" alt="Huellas de Vuelta" width={797} height={805} priority />
        </div>

        <p className={styles.eyebrow}>Recuperar acceso</p>
        <h1 id="recover-title">¿Olvidaste tu contraseña?</h1>
        <p className={styles.description}>
          Ingresa el correo con el que creaste tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {message && <p className={styles.message} role="status">{message}</p>}
          <button className={styles.submit} disabled={isSubmitting} type="submit">{isSubmitting ? "Enviando…" : "Enviar enlace de recuperación"}</button>
        </form>
      </section>
    </main>
  );
}
