"use client";

import { type FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { translateAuthError } from "@/lib/supabase/errors";
import { resolvePanelSession } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/roles";
import styles from "../page.module.css";

type Status = "checking" | "ready" | "invalid";

export default function RestablecerPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Supabase redirige aquí con un token de recuperación en la URL. El
    // cliente lo detecta automáticamente y emite el evento PASSWORD_RECOVERY;
    // también revisamos la sesión actual por si el evento ya se disparó
    // antes de montar este listener.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setStatus((current) => (current === "checking" ? (data.session ? "ready" : "invalid") : current));
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setMessage(null);

    const formData = new FormData(form);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      form.reset();
      setMessage("Tu contraseña se actualizó correctamente. Redirigiendo…");
      const check = await resolvePanelSession();
      const target = check.status === "unauthenticated" ? "/auth?mode=sign-in" : roleHome[check.session.role];
      setTimeout(() => router.push(target), 1500);
    } catch (caughtError) {
      setError(translateAuthError(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "checking") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <div className={styles.logoWrap}>
            <Image className={styles.logo} src="/logo.png" alt="Huellas de Vuelta" width={180} height={180} priority />
          </div>
          <p className={styles.centerNote}>Verificando el enlace…</p>
        </section>
      </main>
    );
  }

  if (status === "invalid") {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <div className={styles.logoWrap}>
            <Image className={styles.logo} src="/logo.png" alt="Huellas de Vuelta" width={180} height={180} priority />
          </div>
          <p className={styles.eyebrow}>Enlace inválido</p>
          <h1>Este enlace ya no es válido</h1>
          <p className={styles.description}>Puede haber expirado o ya haberse utilizado. Solicita uno nuevo para continuar.</p>
          <Link className={styles.submitLink} href="/auth/recuperar">Solicitar nuevo enlace</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="reset-title">
        <div className={styles.logoWrap}>
          <Image className={styles.logo} src="/logo.png" alt="Huellas de Vuelta" width={180} height={180} priority />
        </div>
        <p className={styles.eyebrow}>Nueva contraseña</p>
        <h1 id="reset-title">Crea una nueva contraseña</h1>
        <p className={styles.description}>Elige una contraseña segura para tu cuenta.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label>Confirmar contraseña<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {message && <p className={styles.message} role="status">{message}</p>}
          <button className={styles.submit} disabled={isSubmitting} type="submit">{isSubmitting ? "Guardando…" : "Guardar nueva contraseña"}</button>
        </form>
      </section>
    </main>
  );
}
