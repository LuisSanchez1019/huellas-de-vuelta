"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createPet } from "@/lib/supabase/pets";
import type { PetSpecies, PetStatus } from "@/lib/supabase/types";
import { speciesOptions, statusOptions } from "../labels";
import styles from "../shared.module.css";

export default function NuevaMascotaPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      setIsCheckingSession(false);
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const species = String(formData.get("species") ?? "") as PetSpecies;
    const breed = String(formData.get("breed") ?? "").trim();
    const color = String(formData.get("color") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const status = String(formData.get("status") ?? "at_home") as PetStatus;

    if (name.length < 1 || name.length > 80) {
      setError("El nombre debe tener entre 1 y 80 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const ownerId = sessionData.session?.user.id;
      if (!ownerId) {
        router.replace("/auth");
        return;
      }

      await createPet(supabase, ownerId, {
        name,
        species,
        breed: breed || null,
        color: color || null,
        description: description || null,
        status,
      });

      router.push("/mascotas");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No fue posible guardar la mascota.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>Verificando tu sesión…</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/mascotas">← Tus mascotas</Link>
      <h1 className={styles.title}>Registrar mascota</h1>
      <p className={styles.subtitle}>Guarda los datos básicos; podrás editarlos después.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>Nombre<input name="name" maxLength={80} required /></label>
        <label>
          Especie
          <select name="species" defaultValue="dog" required>
            {speciesOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>Raza (opcional)<input name="breed" maxLength={100} /></label>
        <label>Color (opcional)<input name="color" maxLength={100} /></label>
        <label>Descripción (opcional)<textarea name="description" maxLength={2000} /></label>
        <label>
          Estado
          <select name="status" defaultValue="at_home" required>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.formActions}>
          <button className={styles.submit} disabled={isSubmitting} type="submit">
            {isSubmitting ? "Guardando…" : "Guardar mascota"}
          </button>
        </div>
      </form>
    </main>
  );
}
