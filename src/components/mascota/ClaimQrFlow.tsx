"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resolvePanelSession } from "@/lib/auth/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPets, getPetPhotoSignedUrl } from "@/lib/supabase/pets";
import { claimQrTag, claimQrTagErrorMessage, isClaimTagStateChanged } from "@/lib/supabase/qrClaim";
import type { Pet } from "@/lib/supabase/types";
import { speciesLabels } from "@/lib/pets/labels";
import { PawIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "./publicPet.module.css";

type Phase =
  | "checking"
  | "no-session"
  | "session-error"
  | "picking"
  | "confirming"
  | "claiming"
  | "done";

function speciesText(pet: Pet): string {
  return pet.species === "other" ? pet.species_other || "Otro" : speciesLabels[pet.species];
}

/**
 * Flujo completo de reclamo de una placa QR `available`, dentro de la MISMA
 * página `/m/<publicId>` (nunca cambia de URL, salvo para ir a iniciar
 * sesión y volver con `?next=`). Solo cubre mascotas de `pets` (no
 * `organization_pets`, fuera de alcance de este bloque).
 */
export default function ClaimQrFlow({
  publicId,
  plateCode,
  onClaimed,
}: {
  publicId: string;
  plateCode: string | null;
  onClaimed: () => void;
}) {
  const router = useRouter();
  // Un único cliente por montaje: crear uno nuevo por llamada multiplica las
  // instancias de GoTrueClient activas a la vez (mismo storage key), que es
  // justo lo que produce comportamiento indefinido en el SDK.
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [phase, setPhase] = useState<Phase>("checking");
  const [pets, setPets] = useState<Pet[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    resolvePanelSession().then(async (check) => {
      if (!active) return;
      if (check.status === "error") {
        setPhase("session-error");
        return;
      }
      if (check.status === "unauthenticated") {
        setPhase("no-session");
        return;
      }
      // authenticated o dev: cargar mis mascotas (RLS: solo las propias).
      try {
        const list = await fetchPets(supabase);
        if (!active) return;
        setPets(list);
        const withPhoto = list.filter((pet) => pet.photo_path);
        const entries = await Promise.all(
          withPhoto.map(async (pet) => [pet.id, await getPetPhotoSignedUrl(supabase, pet.photo_path as string)] as const),
        );
        if (!active) return;
        setPhotoUrls(Object.fromEntries(entries.filter((e): e is [string, string] => e[1] !== null)));
        setPhase("picking");
      } catch {
        if (active) setPhase("session-error");
      }
    });
    return () => {
      active = false;
    };
  }, [attempt, supabase]);

  function goToLogin() {
    const next = encodeURIComponent(`/m/${publicId}`);
    router.push(`/auth/usuarios?mode=sign-in&next=${next}`);
  }

  function choosePet(pet: Pet) {
    setSelectedPet(pet);
    setError(null);
    setPhase("confirming");
  }

  async function confirmClaim() {
    if (!selectedPet) return;
    setPhase("claiming");
    setError(null);
    try {
      await claimQrTag(supabase, publicId, selectedPet.id);
      setPhase("done");
      onClaimed();
    } catch (claimError) {
      setError(claimQrTagErrorMessage(claimError));
      if (isClaimTagStateChanged(claimError)) {
        // La placa ya no sigue "available" (alguien más la reclamó, o cambió
        // de estado): refrescamos el perfil para mostrar la realidad actual
        // en vez de dejar esta pantalla desactualizada.
        onClaimed();
        return;
      }
      setPhase("confirming");
    }
  }

  if (phase === "checking") {
    return <p className={styles.state}>Verificando tu sesión…</p>;
  }

  if (phase === "session-error") {
    return (
      <div className={styles.card}>
        <div className={styles.body}>
          <p className={controls.errorText}>No fue posible verificar tu sesión.</p>
          <div className={controls.buttonRow} style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className={controls.button}
              onClick={() => {
                setPhase("checking");
                setAttempt((n) => n + 1);
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "no-session") {
    return (
      <div className={styles.card}>
        <div className={styles.body}>
          <p className={styles.name}>Este código está disponible</p>
          <p className={styles.meta}>
            {plateCode ? `Código ${plateCode}. ` : ""}Todavía no está asignado a ninguna mascota.
          </p>
          <p className={controls.notice} style={{ marginTop: "1rem" }}>
            Para asignarlo a tu mascota, primero inicia sesión con tu cuenta de Huellas de Vuelta.
          </p>
          <div className={controls.buttonRow} style={{ marginTop: "1rem" }}>
            <button type="button" className={controls.button} onClick={goToLogin}>
              Iniciar sesión para asignar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "picking") {
    return (
      <div className={styles.card}>
        <div className={styles.body}>
          <p className={styles.name}>Elige tu mascota</p>
          <p className={styles.meta}>
            {plateCode ? `Código ${plateCode}. ` : ""}Este código quedará vinculado a la mascota que elijas.
          </p>
          {pets.length === 0 ? (
            <p className={controls.notice} style={{ marginTop: "1rem" }}>
              Todavía no tienes mascotas registradas en tu cuenta. Registra una desde tu panel y vuelve a
              escanear este código.
            </p>
          ) : (
            <div className={controls.sectionBody} style={{ marginTop: "1rem" }}>
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  className={controls.buttonSecondary}
                  style={{ justifyContent: "flex-start", width: "100%" }}
                  onClick={() => choosePet(pet)}
                >
                  {photoUrls[pet.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal
                    <img
                      src={photoUrls[pet.id]}
                      alt=""
                      style={{ width: "1.8rem", height: "1.8rem", borderRadius: "50%", objectFit: "cover", marginRight: ".6rem" }}
                    />
                  ) : (
                    <PawIcon size={18} className={styles.inlineIcon} />
                  )}
                  {pet.name} · {speciesText(pet)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if ((phase === "confirming" || phase === "claiming") && selectedPet) {
    return (
      <div className={styles.card}>
        <div className={styles.body}>
          <p className={styles.name}>Confirmar asignación</p>
          <p className={controls.notice} style={{ marginTop: ".75rem" }}>
            El código <b>{plateCode ?? publicId}</b> quedará vinculado a <b>{selectedPet.name}</b>. A partir
            de ahora, escanear este código mostrará el perfil público de {selectedPet.name}.
          </p>

          <div className={styles.detailsGrid} style={{ marginTop: "1rem" }}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Mascota</span>
              <span className={styles.detailValue}>{selectedPet.name}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Especie</span>
              <span className={styles.detailValue}>{speciesText(selectedPet)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Código</span>
              <span className={styles.detailValue}>{plateCode ?? publicId}</span>
            </div>
          </div>

          {error && (
            <p className={controls.errorText} style={{ marginTop: "1rem" }}>
              {error}
            </p>
          )}

          <div className={controls.buttonRow} style={{ marginTop: "1.25rem" }}>
            <button
              type="button"
              className={controls.buttonSecondary}
              disabled={phase === "claiming"}
              onClick={() => {
                setSelectedPet(null);
                setError(null);
                setPhase("picking");
              }}
            >
              Elegir otra mascota
            </button>
            <button type="button" className={controls.button} disabled={phase === "claiming"} onClick={confirmClaim}>
              {phase === "claiming" ? "Asignando…" : "Confirmar asignación"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
