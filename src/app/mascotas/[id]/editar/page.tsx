"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPet, setPetArchived, updatePet } from "@/lib/supabase/pets";
import type { Pet, PetSpecies, PetStatus } from "@/lib/supabase/types";
import { speciesOptions, statusOptions } from "../../labels";
import styles from "../../shared.module.css";

export default function EditarMascotaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const petId = params.id;

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [pet, setPet] = useState<Pet | null | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
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

  useEffect(() => {
    if (isCheckingSession || !petId) return;
    const supabase = createSupabaseBrowserClient();
    fetchPet(supabase, petId)
      .then((data) => setPet(data))
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "No fue posible cargar la mascota.");
        setPet(null);
      });
  }, [isCheckingSession, petId]);

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
      const updated = await updatePet(supabase, petId, {
        name,
        species,
        breed: breed || null,
        color: color || null,
        description: description || null,
        status,
      });
      setPet(updated);
      router.push("/mascotas");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No fue posible guardar los cambios.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleArchived() {
    if (!pet) return;
    setIsArchiving(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const updated = await setPetArchived(supabase, pet.id, !pet.is_archived);
      setPet(updated);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No fue posible actualizar la mascota.");
    } finally {
      setIsArchiving(false);
    }
  }

  if (isCheckingSession || pet === undefined) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>Cargando…</p>
      </main>
    );
  }

  if (pet === null) {
    return (
      <main className={styles.page}>
        <Link className={styles.back} href="/mascotas">← Tus mascotas</Link>
        <p className={styles.empty}>No encontramos esa mascota, o no te pertenece.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/mascotas">← Tus mascotas</Link>
      <h1 className={styles.title}>Editar a {pet.name}</h1>
      <p className={styles.subtitle}>Actualiza los datos o cambia su estado.</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>Nombre<input name="name" defaultValue={pet.name} maxLength={80} required /></label>
        <label>
          Especie
          <select name="species" defaultValue={pet.species} required>
            {speciesOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>Raza (opcional)<input name="breed" defaultValue={pet.breed ?? ""} maxLength={100} /></label>
        <label>Color (opcional)<input name="color" defaultValue={pet.color ?? ""} maxLength={100} /></label>
        <label>Descripción (opcional)<textarea name="description" defaultValue={pet.description ?? ""} maxLength={2000} /></label>
        <label>
          Estado
          <select name="status" defaultValue={pet.status} required>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.formActions}>
          <button className={styles.submit} disabled={isSubmitting} type="submit">
            {isSubmitting ? "Guardando…" : "Guardar cambios"}
          </button>
          <button className={styles.danger} type="button" disabled={isArchiving} onClick={handleToggleArchived}>
            {isArchiving ? "Procesando…" : pet.is_archived ? "Restaurar mascota" : "Archivar mascota"}
          </button>
        </div>
      </form>
    </main>
  );
}
