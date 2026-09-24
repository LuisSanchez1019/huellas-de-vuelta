"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchPets } from "@/lib/supabase/pets";
import { speciesLabels } from "@/lib/pets/labels";
import type { Pet } from "@/lib/supabase/types";
import {
  DURATION_LABELS,
  GRANT_DURATIONS,
  GRANT_STATUS_LABELS,
  PERMISSION_LABELS,
  type GrantDuration,
  type VetPermission,
} from "@/lib/vet/access";
import { vetErrorMessage } from "@/lib/vet/errors";
import { fetchAllForPdf, type Consultation } from "@/lib/vet/medical";
import {
  AUDIT_ACTION_LABELS,
  authorizeOwnerPdf,
  decideAccess,
  fetchEmergencyItems,
  fetchOwnerAccess,
  fetchOwnerHistoryPage,
  fetchPetAccessAudit,
  revokeAccess,
  setEmergencyVisible,
  type AuditEntry,
  type EmergencyItem,
  type OwnerGrant,
} from "@/lib/vet/ownerAccess";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import controls from "@/components/ui/controls.module.css";
import { ConsultationCard } from "./MedicalRecordView";
import styles from "./vet.module.css";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const KIND_LABELS: Record<string, string> = { condition: "Condición", allergy: "Alergia", medication: "Medicamento", urgent: "Urgente" };

/**
 * Privacidad de la ficha médica (propietario): solicitudes de acceso de
 * veterinarias, accesos vigentes (revocables al instante), qué se comparte en
 * emergencias, historia clínica con PDF y registro de accesos.
 */
export default function OwnerVetAccess() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [grants, setGrants] = useState<OwnerGrant[] | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approving, setApproving] = useState<OwnerGrant | null>(null);
  const [approvePerms, setApprovePerms] = useState<Set<VetPermission>>(new Set());
  const [approveDuration, setApproveDuration] = useState<GrantDuration>("1h");
  const [revoking, setRevoking] = useState<OwnerGrant | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setGrants(await fetchOwnerAccess(supabase));
    } catch (e) {
      setError(vetErrorMessage(e));
    }
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    fetchOwnerAccess(supabase)
      .then((list) => {
        if (alive) setGrants(list);
      })
      .catch((e) => {
        if (alive) setError(vetErrorMessage(e));
      });
    fetchPets(supabase)
      .then((list) => {
        if (!alive) return;
        setPets(list);
        setPetId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => {});
    const id = window.setInterval(() => {
      fetchOwnerAccess(supabase)
        .then((list) => {
          if (alive) setGrants(list);
        })
        .catch(() => {});
    }, 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [supabase]);

  function openApprove(grant: OwnerGrant) {
    setApproving(grant);
    setApprovePerms(new Set(grant.requestedPermissions));
    setApproveDuration(grant.requestedDuration);
    setError(null);
  }

  async function confirmApprove() {
    if (!approving || busy) return;
    if (approvePerms.size === 0) {
      setError("Selecciona al menos un permiso para autorizar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await decideAccess(supabase, approving.id, {
        approve: true,
        permissions: approving.requestedPermissions.filter((p) => approvePerms.has(p)),
        duration: approveDuration,
      });
      setNotice("Acceso autorizado.");
      setApproving(null);
      await load();
    } catch (e) {
      setError(vetErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function deny(grant: OwnerGrant) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await decideAccess(supabase, grant.id, { approve: false });
      setNotice("Solicitud rechazada.");
      await load();
    } catch (e) {
      setError(vetErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRevoke() {
    if (!revoking || busy) return;
    setBusy(true);
    setError(null);
    try {
      await revokeAccess(supabase, revoking.id);
      setNotice("Acceso revocado. La veterinaria lo pierde de inmediato.");
      setRevoking(null);
      await load();
    } catch (e) {
      setError(vetErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const pending = (grants ?? []).filter((g) => g.effectiveStatus === "pending");
  const active = (grants ?? []).filter((g) => g.effectiveStatus === "active");
  const past = (grants ?? []).filter((g) => !["pending", "active"].includes(g.effectiveStatus)).slice(0, 10);

  return (
    <div>
      {error && <p className={controls.errorText} role="alert">{error}</p>}
      {notice && <p className={styles.info} role="status">{notice}</p>}

      <section className={controls.section}>
        <h2 className={controls.sectionTitle}>Solicitudes de acceso a la ficha médica</h2>
        {!grants ? (
          <p className={controls.loading}>Cargando…</p>
        ) : pending.length === 0 ? (
          <p className={styles.meta} style={{ marginTop: ".5rem" }}>No tienes solicitudes pendientes.</p>
        ) : (
          <div className={styles.list}>
            {pending.map((g) => (
              <div key={g.id} className={styles.listItem}>
                <div className={styles.listItemHead}>
                  <span className={styles.itemTitle}>{g.orgName}</span>
                  <span className={`${styles.badge} ${styles.badgeInfo}`}>Pendiente</span>
                </div>
                <p className={styles.meta}>Profesional: {g.vetName} · Mascota: {g.petName} · {fmt(g.createdAt)}</p>
                <div className={styles.badges}>
                  {g.requestedPermissions.map((p) => (
                    <span key={p} className={styles.badge}>{PERMISSION_LABELS[p]}</span>
                  ))}
                </div>
                <p className={styles.meta}>Duración solicitada: {DURATION_LABELS[g.requestedDuration]}</p>
                {g.reason && <p className={styles.kvValue}>Motivo: {g.reason}</p>}
                <div className={controls.buttonRow}>
                  <button type="button" className={controls.button} disabled={busy} onClick={() => openApprove(g)}>Autorizar</button>
                  <button type="button" className={controls.buttonSecondary} disabled={busy} onClick={() => deny(g)}>Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={controls.section}>
        <h2 className={controls.sectionTitle}>Accesos veterinarios activos</h2>
        {active.length === 0 ? (
          <p className={styles.meta} style={{ marginTop: ".5rem" }}>Ninguna veterinaria tiene acceso en este momento.</p>
        ) : (
          <div className={styles.list}>
            {active.map((g) => (
              <div key={g.id} className={styles.listItem}>
                <div className={styles.listItemHead}>
                  <span className={styles.itemTitle}>{g.orgName} · {g.petName}</span>
                  <span className={`${styles.badge} ${styles.badgeOk}`}>Acceso activo</span>
                </div>
                <p className={styles.meta}>Expira {g.expiresAt ? fmt(g.expiresAt) : "—"} · Profesional: {g.vetName}</p>
                <div className={styles.badges}>
                  {g.grantedPermissions.map((p) => (
                    <span key={p} className={styles.badge}>{PERMISSION_LABELS[p]}</span>
                  ))}
                </div>
                <div className={controls.buttonRow}>
                  <button type="button" className={controls.buttonDanger} disabled={busy} onClick={() => setRevoking(g)}>Revocar acceso</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {past.length > 0 && (
          <>
            <h3 className={controls.sectionTitle} style={{ marginTop: "1.25rem", fontSize: ".9rem" }}>Anteriores</h3>
            <div className={styles.list}>
              {past.map((g) => (
                <p key={g.id} className={styles.meta}>
                  {g.orgName} · {g.petName} · {GRANT_STATUS_LABELS[g.effectiveStatus]} · {fmt(g.revokedAt ?? g.decidedAt ?? g.createdAt)}
                </p>
              ))}
            </div>
          </>
        )}
      </section>

      {pets.length > 0 && (
        <section className={controls.section}>
          <h2 className={controls.sectionTitle}>Ficha médica de mi mascota</h2>
          <label className={controls.field} style={{ marginTop: ".75rem", maxWidth: "22rem" }}>
            Mascota
            <select className={controls.select} value={petId} onChange={(e) => setPetId(e.target.value)}>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {speciesLabels[p.species]}</option>
              ))}
            </select>
          </label>
          {petId && <PetMedicalPrivacy key={petId} petId={petId} />}
        </section>
      )}

      <Modal open={approving !== null} title="Solicitud de acceso a la ficha médica" onClose={() => setApproving(null)}>
        {approving && (
          <div className={controls.sectionBody}>
            <p className={styles.kvValue}>Veterinaria: <strong>{approving.orgName}</strong></p>
            <p className={styles.kvValue}>Profesional: {approving.vetName}</p>
            <p className={styles.kvValue}>Mascota: <strong>{approving.petName}</strong></p>
            <fieldset className={styles.permGrid} style={{ border: 0, padding: 0 }}>
              <legend className={controls.sectionTitle}>Permisos que otorgas</legend>
              {approving.requestedPermissions.map((p) => (
                <label key={p} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={approvePerms.has(p)}
                    onChange={() =>
                      setApprovePerms((prev) => {
                        const next = new Set(prev);
                        if (next.has(p)) next.delete(p);
                        else next.add(p);
                        return next;
                      })
                    }
                  />
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
            </fieldset>
            <label className={controls.field}>
              Duración del acceso
              <select className={controls.select} value={approveDuration} onChange={(e) => setApproveDuration(e.target.value as GrantDuration)}>
                {GRANT_DURATIONS.map((d) => (
                  <option key={d} value={d}>{DURATION_LABELS[d]}</option>
                ))}
              </select>
            </label>
            <p className={styles.meta}>El acceso vence solo y puedes revocarlo cuando quieras. Todo queda registrado.</p>
            <div className={controls.buttonRow}>
              <button type="button" className={controls.button} disabled={busy} onClick={confirmApprove}>{busy ? "Autorizando…" : "Autorizar"}</button>
              <button type="button" className={controls.buttonSecondary} onClick={() => setApproving(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        title="Revocar acceso"
        message={revoking ? `${revoking.orgName} perderá el acceso a la ficha de ${revoking.petName} de inmediato.` : ""}
        confirmLabel="Revocar"
        tone="danger"
        onConfirm={confirmRevoke}
        onCancel={() => setRevoking(null)}
      />
    </div>
  );
}

type PetTab = "emergency" | "history" | "audit";

function PetMedicalPrivacy({ petId }: { petId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [tab, setTab] = useState<PetTab>("emergency");
  const [items, setItems] = useState<EmergencyItem[] | null>(null);
  const [history, setHistory] = useState<Consultation[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (tab === "emergency") {
      fetchEmergencyItems(supabase, petId).then((r) => alive && setItems(r)).catch((e) => alive && setError(vetErrorMessage(e)));
    } else if (tab === "history") {
      fetchOwnerHistoryPage(supabase, petId, { limit: 10 })
        .then((p) => {
          if (!alive) return;
          setHistory(p.items);
          setHasMore(p.hasMore);
          setNext(p.nextBefore);
        })
        .catch((e) => alive && setError(vetErrorMessage(e)));
    } else {
      fetchPetAccessAudit(supabase, petId).then((r) => alive && setAudit(r)).catch((e) => alive && setError(vetErrorMessage(e)));
    }
    return () => {
      alive = false;
    };
  }, [supabase, petId, tab]);

  async function toggle(item: EmergencyItem) {
    setError(null);
    try {
      await setEmergencyVisible(supabase, item.id, !item.emergencyVisible);
      setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, emergencyVisible: !i.emergencyVisible } : i)) ?? null);
    } catch (e) {
      setError(vetErrorMessage(e));
    }
  }

  async function loadMore() {
    if (!next) return;
    try {
      const p = await fetchOwnerHistoryPage(supabase, petId, { limit: 10, before: next });
      setHistory((prev) => [...(prev ?? []), ...p.items]);
      setHasMore(p.hasMore);
      setNext(p.nextBefore);
    } catch (e) {
      setError(vetErrorMessage(e));
    }
  }

  async function downloadPdf() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const auth = await authorizeOwnerPdf(supabase, petId);
      const all = await fetchAllForPdf((before) => fetchOwnerHistoryPage(supabase, petId, { limit: 50, before }));
      const { buildMedicalHistoryPdf, medicalPdfFileName } = await import("@/lib/pdf/medicalHistory");
      const doc = buildMedicalHistoryPdf(
        {
          petName: auth.petName,
          speciesLabel: speciesLabels[auth.species as keyof typeof speciesLabels] ?? auth.species,
          breed: auth.breed,
          plateCode: auth.plateCode,
          generatedBy: auth.ownerName ?? "Propietario",
          generatedAt: auth.generatedAt,
        },
        all,
      );
      doc.save(medicalPdfFileName(auth.petName));
    } catch (e) {
      setError(vetErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className={styles.tabs}>
        {(
          [
            ["emergency", "Información de emergencia"],
            ["history", "Historia clínica"],
            ["audit", "Registro de accesos"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" className={`${styles.tab} ${tab === value ? styles.tabActive : ""}`} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className={controls.errorText} role="alert" style={{ marginTop: ".75rem" }}>{error}</p>}

      {tab === "emergency" && (
        <div style={{ marginTop: "1rem" }}>
          <p className={styles.info}>
            Marca lo que una veterinaria podrá ver SOLO en una emergencia, sin tu autorización previa. Nunca se muestra
            la historia clínica completa y cada acceso queda registrado y te llega como notificación. Por defecto no se comparte nada.
          </p>
          {items === null ? (
            <p className={controls.loading}>Cargando…</p>
          ) : items.length === 0 ? (
            <p className={styles.meta} style={{ marginTop: ".75rem" }}>
              Todavía no registraste condiciones, alergias ni medicamentos para esta mascota (se agregan en «Mis mascotas»).
            </p>
          ) : (
            <div className={styles.list}>
              {items.map((item) => (
                <label key={item.id} className={styles.check}>
                  <input type="checkbox" checked={item.emergencyVisible} onChange={() => toggle(item)} />
                  <span>{KIND_LABELS[item.kind] ?? item.kind}: <strong>{item.label}</strong>{item.detail ? ` — ${item.detail}` : ""}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div style={{ marginTop: "1rem" }}>
          <div className={controls.buttonRow}>
            <button type="button" className={controls.buttonSecondary} disabled={busy || !history?.length} onClick={downloadPdf}>
              {busy ? "Generando…" : "Descargar PDF"}
            </button>
          </div>
          <div className={styles.list}>
            {history === null && <p className={controls.loading}>Cargando…</p>}
            {history?.length === 0 && <p className={styles.meta}>Todavía no hay consultas registradas.</p>}
            {history?.map((c) => <ConsultationCard key={c.id} c={c} canAddendum={false} />)}
            {hasMore && <button type="button" className={controls.buttonSecondary} onClick={loadMore}>Cargar consultas anteriores</button>}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className={styles.list}>
          {audit === null && <p className={controls.loading}>Cargando…</p>}
          {audit?.length === 0 && <p className={styles.meta}>Todavía no hay accesos registrados.</p>}
          {audit?.map((a, i) => (
            <div key={i} className={styles.listItem}>
              <div className={styles.listItemHead}>
                <span className={styles.itemTitle}>{AUDIT_ACTION_LABELS[a.action] ?? a.action}</span>
                <span className={styles.meta}>{fmt(a.at)}</span>
              </div>
              <p className={styles.meta}>
                {a.orgName ?? ""}{a.vetName ? ` · ${a.vetName}` : ""}{a.method ? ` · ${a.method}` : ""}
              </p>
              {a.emergencyReason && <p className={styles.kvValue}>Motivo indicado: {a.emergencyReason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
