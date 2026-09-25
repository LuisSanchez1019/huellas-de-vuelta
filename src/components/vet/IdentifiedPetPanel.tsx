"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PawIcon } from "@/components/icons/Icon";
import { speciesLabels, statusLabels } from "@/lib/pets/labels";
import PetPhoto from "@/components/ui/PetPhoto";
import type { PetSpecies, PetStatus } from "@/lib/supabase/types";
import {
  DURATION_LABELS,
  GRANT_DURATIONS,
  PERMISSION_LABELS,
  VET_PERMISSIONS,
  getGrant,
  requestAccess,
  type GrantDuration,
  type VetGrant,
  type VetPermission,
} from "@/lib/vet/access";
import { vetErrorMessage } from "@/lib/vet/errors";
import type { IdentificationMethod, IdentifyResult } from "@/lib/vet/identification";
import { emergencyAccess, type EmergencyInfo } from "@/lib/vet/medical";
import controls from "@/components/ui/controls.module.css";
import styles from "./vet.module.css";

type Found = Extract<IdentifyResult, { outcome: "found" }>;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Resultado de identificar una mascota. Recuerda: IDENTIFICAR no es AUTORIZAR.
 * Aquí solo hay información pública mínima; la historia clínica exige un grant
 * vigente que el propietario concede, y la emergencia solo devuelve lo que el
 * propietario marcó para emergencias.
 */
export default function IdentifiedPetPanel({
  supabase,
  found,
  method,
}: {
  supabase: SupabaseClient;
  found: Found;
  method: IdentificationMethod;
}) {
  const [grant, setGrant] = useState<VetGrant | null>(found.grant);
  const [showRequest, setShowRequest] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [perms, setPerms] = useState<Set<VetPermission>>(new Set(["can_read_medical"]));
  const [duration, setDuration] = useState<GrantDuration>("1h");
  const [reason, setReason] = useState("");
  const [emReason, setEmReason] = useState("");
  const [emergency, setEmergency] = useState<EmergencyInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { pet } = found;
  const pending = grant?.effectiveStatus === "pending";
  const active = grant?.effectiveStatus === "active";

  // Mientras la solicitud está pendiente se consulta (ligero, sin auditar) si el propietario ya respondió.
  useEffect(() => {
    if (!pending || !grant) return;
    const grantId = grant.id;
    let alive = true;
    const id = window.setInterval(() => {
      getGrant(supabase, grantId)
        .then((g) => {
          if (alive) setGrant(g);
        })
        .catch(() => {});
    }, 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [pending, grant, supabase]);

  function togglePerm(perm: VetPermission) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (perms.size === 0) {
      setError("Selecciona al menos un permiso.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await requestAccess(supabase, {
        tagPublicId: found.tagPublicId,
        permissions: VET_PERMISSIONS.filter((p) => perms.has(p)),
        duration,
        reason: reason.trim() || null,
        method,
      });
      setGrant(result.grant);
      setShowRequest(false);
    } catch (e) {
      setError(vetErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitEmergency(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (emReason.trim().length < 10) {
      setError("Escribe un motivo de al menos 10 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setEmergency(await emergencyAccess(supabase, found.tagPublicId, emReason.trim(), method));
      setShowEmergency(false);
    } catch (e) {
      setError(vetErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const speciesText = pet.species === "other" ? pet.speciesOther || "Otro" : speciesLabels[pet.species as PetSpecies] ?? pet.species;

  return (
    <div className={styles.result}>
      <div className={styles.resultTop}>
        <div className={styles.avatar}>
          <PetPhoto path={pet.photoPath} alt={`Foto de ${pet.name}`} fallback={<PawIcon size={32} />} />
        </div>
        <div>
          <p className={styles.petName}>{pet.name}</p>
          <p className={styles.meta}>
            {speciesText}
            {pet.breed ? ` · ${pet.breed}` : ""} · Placa {found.plateCode}
          </p>
          <div className={styles.badges} style={{ marginTop: ".4rem" }}>
            <span className={styles.badge}>{statusLabels[pet.status as PetStatus] ?? pet.status}</span>
            {pet.medicalAlert && <span className={`${styles.badge} ${styles.badgeWarn}`}>Alerta médica pública</span>}
          </div>
        </div>
      </div>

      {active && grant?.expiresAt && (
        <>
          <p className={styles.info}>Tienes un acceso vigente a la ficha hasta {fmtTime(grant.expiresAt)}.</p>
          <div className={controls.buttonRow}>
            <Link className={controls.button} href={`/veterinaria/consultar/${grant.id}`}>Abrir ficha</Link>
          </div>
        </>
      )}

      {pending && (
        <p className={styles.info}>
          Solicitud enviada. Esperando la respuesta del propietario. Esta pantalla se actualiza sola.
        </p>
      )}

      {!active && !pending && !emergency && (
        <>
          <p className={styles.info}>El acceso a la historia clínica requiere autorización del propietario.</p>
          {grant?.effectiveStatus === "denied" && (
            <p className={controls.errorText}>La última solicitud fue rechazada.</p>
          )}
          {grant?.effectiveStatus === "expired" && <p className={controls.errorText}>El acceso anterior venció.</p>}
        </>
      )}

      {!active && !pending && !showRequest && (
        <div className={controls.buttonRow}>
          <button type="button" className={controls.button} onClick={() => { setShowRequest(true); setShowEmergency(false); setError(null); }}>
            Solicitar acceso
          </button>
        </div>
      )}

      {showRequest && (
        <form className={controls.sectionBody} onSubmit={submitRequest}>
          <fieldset className={styles.permGrid} style={{ border: 0, padding: 0 }}>
            <legend className={controls.sectionTitle}>Permisos que solicitas</legend>
            {VET_PERMISSIONS.map((perm) => (
              <label key={perm} className={styles.check}>
                <input type="checkbox" checked={perms.has(perm)} onChange={() => togglePerm(perm)} />
                {PERMISSION_LABELS[perm]}
              </label>
            ))}
          </fieldset>
          <label className={controls.field}>
            Duración solicitada
            <select className={controls.select} value={duration} onChange={(e) => setDuration(e.target.value as GrantDuration)}>
              {GRANT_DURATIONS.map((d) => (
                <option key={d} value={d}>{DURATION_LABELS[d]}</option>
              ))}
            </select>
          </label>
          <label className={controls.field}>
            Motivo (opcional)
            <textarea className={controls.textarea} value={reason} maxLength={300} rows={2} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className={controls.buttonRow}>
            <button type="submit" className={controls.button} disabled={busy}>{busy ? "Enviando…" : "Enviar solicitud"}</button>
            <button type="button" className={controls.buttonSecondary} onClick={() => setShowRequest(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {emergency ? (
        <div className={styles.locked} role="status" style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-fg)" }}>
          <strong>Información de emergencia de {emergency.pet.name}</strong>
          {emergency.items.length === 0 ? (
            <p>El propietario no marcó información para emergencias.</p>
          ) : (
            <ul style={{ margin: ".5rem 0 0 1rem" }}>
              {emergency.items.map((item, index) => (
                <li key={index}>{item.label}{item.detail ? ` — ${item.detail}` : ""}</li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: ".6rem", fontWeight: 500 }}>
            Este acceso quedó registrado y se notificó al propietario. No incluye la historia clínica.
          </p>
        </div>
      ) : (
        !showEmergency && (
          <div className={controls.buttonRow}>
            <button
              type="button"
              className={controls.buttonSecondary}
              disabled={!found.hasEmergencyInfo}
              onClick={() => { setShowEmergency(true); setShowRequest(false); setError(null); }}
            >
              Acceso de emergencia
            </button>
            {!found.hasEmergencyInfo && (
              <span className={styles.meta} style={{ alignSelf: "center" }}>El propietario no compartió información de emergencia.</span>
            )}
          </div>
        )
      )}

      {showEmergency && (
        <form className={controls.sectionBody} onSubmit={submitEmergency}>
          <p className={styles.info}>
            Solo se mostrará lo que el propietario marcó para emergencias. Quedará registrado y se le avisará al propietario.
          </p>
          <label className={controls.field}>
            Motivo de la emergencia (mínimo 10 caracteres)
            <textarea className={controls.textarea} value={emReason} maxLength={300} rows={2} onChange={(e) => setEmReason(e.target.value)} required />
          </label>
          <div className={controls.buttonRow}>
            <button type="submit" className={controls.button} disabled={busy}>{busy ? "Consultando…" : "Ver información de emergencia"}</button>
            <button type="button" className={controls.buttonSecondary} onClick={() => setShowEmergency(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {error && <p className={controls.errorText} role="alert">{error}</p>}
    </div>
  );
}
