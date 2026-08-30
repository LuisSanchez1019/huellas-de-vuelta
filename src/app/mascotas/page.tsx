"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPets, setPetArchived } from "@/lib/supabase/pets";
import type { Pet } from "@/lib/supabase/types";
import { speciesLabels, statusLabels } from "./labels";
import styles from "./shared.module.css";

const badgeClassByStatus: Record<Pet["status"], string> = {
  at_home: styles.badgeAtHome,
  lost: styles.badgeLost,
  found: styles.badgeFound,
  for_adoption: styles.badgeForAdoption,
};

export default function MascotasPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      setSession(data.session);
      setIsCheckingSession(false);
    });
  }, [router]);

  const loadPets = useCallback(() => {
    // Se difiere a una continuación de promesa (en vez de setState síncrono
    // al inicio) para cumplir con la regla react-hooks/set-state-in-effect.
    return Promise.resolve().then(async () => {
      setIsLoadingPets(true);
      setError(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const data = await fetchPets(supabase, { includeArchived: showArchived });
        setPets(data);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "No fue posible cargar las mascotas.");
      } finally {
        setIsLoadingPets(false);
      }
    });
  }, [showArchived]);

  useEffect(() => {
    if (!session) return;
    loadPets();
  }, [session, loadPets]);

  async function handleToggleArchived(pet: Pet) {
    setPendingId(pet.id);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      await setPetArchived(supabase, pet.id, !pet.is_archived);
      await loadPets();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No fue posible actualizar la mascota.");
    } finally {
      setPendingId(null);
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
      <div className={styles.topBar}>
        <Link className={styles.back} href="/">← Huellas de Vuelta</Link>
      </div>
      <h1 className={styles.title}>Tus mascotas</h1>
      <p className={styles.subtitle}>Administra las mascotas a tu cuidado.</p>
      <Link className={styles.newLink} href="/mascotas/nueva">+ Registrar mascota</Link>

      <label className={styles.toolbar}>
        <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
        Mostrar archivadas
      </label>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {isLoadingPets ? (
        <p className={styles.loading}>Cargando mascotas…</p>
      ) : pets.length === 0 ? (
        <p className={styles.empty}>
          {showArchived ? "No tienes mascotas archivadas." : "Todavía no has registrado ninguna mascota."}
        </p>
      ) : (
        <ul className={styles.grid}>
          {pets.map((pet) => (
            <li key={pet.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.petName}>{pet.name}</span>
                <span className={`${styles.badge} ${badgeClassByStatus[pet.status]}`}>{statusLabels[pet.status]}</span>
              </div>
              <p className={styles.meta}>
                {speciesLabels[pet.species]}
                {pet.breed ? ` · ${pet.breed}` : ""}
                {pet.color ? ` · ${pet.color}` : ""}
              </p>
              {pet.description && <p className={styles.desc}>{pet.description}</p>}
              <div className={styles.cardActions}>
                <Link className={styles.actionLink} href={`/mascotas/${pet.id}/editar`}>Editar</Link>
                <button
                  className={styles.actionButton}
                  type="button"
                  disabled={pendingId === pet.id}
                  onClick={() => handleToggleArchived(pet)}
                >
                  {pet.is_archived ? "Restaurar" : "Archivar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
