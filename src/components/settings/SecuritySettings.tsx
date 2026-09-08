"use client";

import { type FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import controls from "@/components/ui/controls.module.css";
import styles from "./settings.module.css";

export default function SecuritySettings() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);
    if (!email) {
      setError("No hay una sesión activa con correo.");
      return;
    }
    if (next.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    if (next === current) {
      setError("La nueva contraseña debe ser distinta de la actual.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // Reautenticar: confirma que quien pide el cambio conoce la contraseña actual.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInError) {
        setError("La contraseña actual no es correcta.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(updateError.message || "No fue posible cambiar la contraseña.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch {
      setError("No fue posible cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className={controls.loading}>Cargando…</p>;
  if (!email) {
    return <p className={controls.empty}>Inicia sesión con una cuenta real para cambiar tu contraseña.</p>;
  }

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Seguridad</h1>
        <p className={styles.subtitle}>Cambia la contraseña de tu cuenta. No se muestra ninguna contraseña.</p>
      </header>

      <form className={styles.card} onSubmit={handleSubmit}>
        <p className={styles.cardTitle}>Cambiar contraseña</p>

        <label className={styles.field}>
          Contraseña actual
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          Nueva contraseña
          <input
            className={styles.input}
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          <span className={styles.hint}>Mínimo 8 caracteres.</span>
        </label>
        <label className={styles.field}>
          Confirmar nueva contraseña
          <input
            className={styles.input}
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>

        {error && <p className={styles.error} role="alert">{error}</p>}
        {done && <p className={styles.success} role="status">Contraseña actualizada correctamente.</p>}

        <div className={styles.actionRow}>
          <button type="submit" className={styles.linkButton} disabled={busy}>
            {busy ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </div>
      </form>
    </section>
  );
}
