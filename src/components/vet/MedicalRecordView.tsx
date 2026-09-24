"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { speciesLabels } from "@/lib/pets/labels";
import type { PetSpecies } from "@/lib/supabase/types";
import { PERMISSION_LABELS, getGrant, type VetGrant } from "@/lib/vet/access";
import { isAccessLost, vetErrorMessage } from "@/lib/vet/errors";
import {
  ROUTE_LABELS,
  URGENCY_LABELS,
  addAddendum,
  authorizePdf,
  createConsultation,
  fetchAllForPdf,
  fetchHistoryPage,
  fetchOverview,
  type Consultation,
  type MedicalOverview,
  type MedicationInput,
  type Urgency,
} from "@/lib/vet/medical";
import controls from "@/components/ui/controls.module.css";
import styles from "./vet.module.css";

const POLL_MS = 20000;

function fmtDate(iso: string, time = true): string {
  const d = new Date(iso);
  return time
    ? d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function KV({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className={styles.kv}>
      <span className={styles.kvLabel}>{label}</span>
      <span className={styles.kvValue}>{value}</span>
    </div>
  );
}

const emptyMed = (): MedicationInput => ({ name: "" });

/**
 * Ficha clínica de una mascota con un grant vigente. La BD vuelve a comprobar el
 * grant (vigente, no vencido, permiso específico) en CADA llamada; además la
 * pantalla lo sondea cada 20 s y, si se revoca o vence, se bloquea y BORRA de
 * memoria lo que estaba mostrando. Nada se guarda en localStorage/sessionStorage
 * ni en la URL (solo el id del grant, que no es un dato médico).
 */
export default function MedicalRecordView({ grantId }: { grantId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [grant, setGrant] = useState<VetGrant | null>(null);
  const [lost, setLost] = useState<string | null>(null);
  const [overview, setOverview] = useState<MedicalOverview | null>(null);
  const [history, setHistory] = useState<Consultation[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [tab, setTab] = useState<"history" | "new">("history");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const perms = useMemo(() => new Set(grant?.grantedPermissions ?? []), [grant]);
  const canRead = perms.has("can_read_medical");
  const canCreate = perms.has("can_create_consultation");
  const canDx = perms.has("can_add_diagnosis");
  const canTx = perms.has("can_add_treatment");
  const canPdf = perms.has("can_generate_pdf") && canRead;

  const lock = useCallback((message: string) => {
    setLost(message);
    setOverview(null);
    setHistory([]);
    setHasMore(false);
    setNext(null);
  }, []);

  const handleError = useCallback(
    (e: unknown) => {
      if (isAccessLost(e)) lock("Tu acceso a esta ficha ya no está vigente (fue revocado o venció). Se cerró la ficha.");
      else setError(vetErrorMessage(e));
    },
    [lock],
  );

  // Estado real del grant al abrir y cada POLL_MS. Si deja de estar activo, se bloquea todo.
  useEffect(() => {
    let alive = true;
    const check = () =>
      getGrant(supabase, grantId)
        .then((g) => {
          if (!alive) return;
          setNow(Date.now());
          if (g.effectiveStatus !== "active") {
            lock(
              g.effectiveStatus === "revoked"
                ? "El propietario revocó tu acceso. Se cerró la ficha."
                : g.effectiveStatus === "expired"
                  ? "Tu acceso venció. Se cerró la ficha."
                  : "No tienes un acceso vigente a esta ficha.",
            );
          }
          setGrant(g);
        })
        .catch((e) => {
          if (alive) handleError(e);
        });
    void check();
    const id = window.setInterval(check, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [supabase, grantId, lock, handleError]);

  // Carga la ficha SOLO cuando hay grant activo con can_read_medical.
  const activeAndRead = grant?.effectiveStatus === "active" && canRead;
  useEffect(() => {
    if (!activeAndRead) return;
    let alive = true;
    Promise.all([fetchOverview(supabase, grantId), fetchHistoryPage(supabase, grantId, { limit: 10 })])
      .then(([ov, page]) => {
        if (!alive) return;
        setOverview(ov);
        setHistory(page.items);
        setHasMore(page.hasMore);
        setNext(page.nextBefore);
      })
      .catch((e) => {
        if (alive) handleError(e);
      });
    return () => {
      alive = false;
    };
  }, [activeAndRead, supabase, grantId, handleError]);

  async function loadMore() {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchHistoryPage(supabase, grantId, { limit: 10, before: next });
      setHistory((prev) => [...prev, ...page.items]);
      setHasMore(page.hasMore);
      setNext(page.nextBefore);
    } catch (e) {
      handleError(e);
    } finally {
      setLoadingMore(false);
    }
  }

  async function refreshHistory() {
    try {
      const page = await fetchHistoryPage(supabase, grantId, { limit: 10 });
      setHistory(page.items);
      setHasMore(page.hasMore);
      setNext(page.nextBefore);
      setOverview(await fetchOverview(supabase, grantId));
    } catch (e) {
      handleError(e);
    }
  }

  async function downloadPdf() {
    if (busy || !grant) return;
    setBusy(true);
    setError(null);
    try {
      const auth = await authorizePdf(supabase, grantId);
      const consultations = await fetchAllForPdf((before) => fetchHistoryPage(supabase, grantId, { limit: 50, before }));
      const { buildMedicalHistoryPdf, medicalPdfFileName } = await import("@/lib/pdf/medicalHistory");
      const doc = buildMedicalHistoryPdf(
        {
          petName: auth.petName,
          speciesLabel: overview ? speciesLabels[overview.pet.species as PetSpecies] ?? overview.pet.species : "",
          breed: overview?.pet.breed ?? null,
          plateCode: auth.plateCode,
          generatedBy: `${auth.orgName ?? "Veterinaria"} — ${auth.vetName ?? "Profesional"}`,
          generatedAt: auth.generatedAt,
        },
        consultations,
      );
      doc.save(medicalPdfFileName(auth.petName));
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  // ---------- estados de pantalla ----------
  if (lost) {
    return (
      <div>
        <div className={styles.locked} role="alert">{lost}</div>
        <div className={controls.buttonRow} style={{ marginTop: "1rem" }}>
          <Link className={controls.button} href="/veterinaria/consultar">Volver a Consultar mascota</Link>
        </div>
      </div>
    );
  }
  if (!grant) return <p className={controls.loading}>Verificando tu acceso…</p>;

  const minutesLeft = grant.expiresAt ? Math.max(0, Math.round((new Date(grant.expiresAt).getTime() - now) / 60000)) : 0;

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Ficha de {overview?.pet.name ?? grant.petName ?? "la mascota"}</h1>
        <p className={controls.pageSubtitle}>
          Acceso vigente hasta {grant.expiresAt ? fmtDate(grant.expiresAt) : "—"} (unos {minutesLeft} min). Todo lo que
          consultes o registres queda auditado y el propietario puede revocar el acceso en cualquier momento.
        </p>
        <div className={styles.badges} style={{ marginTop: ".6rem" }}>
          {grant.grantedPermissions.map((p) => (
            <span key={p} className={`${styles.badge} ${styles.badgeOk}`}>{PERMISSION_LABELS[p]}</span>
          ))}
        </div>
      </div>

      {error && <p className={controls.errorText} role="alert">{error}</p>}
      {notice && <p className={styles.info} role="status">{notice}</p>}

      {!canRead && (
        <p className={styles.info}>
          Tu autorización no incluye consultar la historia. {canCreate ? "Puedes registrar una consulta." : ""}
        </p>
      )}

      {overview && (
        <section className={controls.section}>
          <h2 className={controls.sectionTitle}>Datos de la mascota</h2>
          <div className={controls.sectionBody}>
            <KV label="Especie / raza" value={`${overview.pet.species === "other" ? overview.pet.speciesOther ?? "Otro" : speciesLabels[overview.pet.species as PetSpecies] ?? overview.pet.species}${overview.pet.breed ? ` · ${overview.pet.breed}` : ""}`} />
            <KV label="Placa" value={overview.plateCode} />
            {overview.declaredItems.length > 0 && (
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Antecedentes declarados por el propietario</span>
                <ul className={styles.meds}>
                  {overview.declaredItems.map((item, i) => (
                    <li key={i} className={styles.kvValue}>{item.label}{item.detail ? ` — ${item.detail}` : ""}</li>
                  ))}
                </ul>
              </div>
            )}
            <KV label="Observaciones del propietario" value={overview.summary?.notes} />
          </div>
        </section>
      )}

      <div className={styles.tabs}>
        {canRead && (
          <button type="button" className={`${styles.tab} ${tab === "history" ? styles.tabActive : ""}`} onClick={() => setTab("history")}>
            Historia clínica{overview ? ` (${overview.consultationCount})` : ""}
          </button>
        )}
        {canCreate && (
          <button type="button" className={`${styles.tab} ${tab === "new" || !canRead ? styles.tabActive : ""}`} onClick={() => setTab("new")}>
            Registrar consulta
          </button>
        )}
        {canPdf && (
          <button type="button" className={styles.tab} disabled={busy} onClick={downloadPdf}>
            {busy ? "Generando…" : "Descargar PDF"}
          </button>
        )}
      </div>

      {canRead && tab === "history" && (
        <div className={styles.list}>
          {history.length === 0 && <p className={controls.empty}>Todavía no hay consultas registradas.</p>}
          {history.map((c) => (
            <ConsultationCard
              key={c.id}
              c={c}
              canAddendum={canCreate && c.ownOrg}
              onAddendum={async (requestId, body) => {
                try {
                  await addAddendum(supabase, grantId, requestId, c.id, body);
                  setNotice("Aclaración registrada.");
                  await refreshHistory();
                  return true;
                } catch (e) {
                  handleError(e);
                  return false;
                }
              }}
            />
          ))}
          {hasMore && (
            <button type="button" className={controls.buttonSecondary} disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? "Cargando…" : "Cargar consultas anteriores"}
            </button>
          )}
        </div>
      )}

      {canCreate && (tab === "new" || !canRead) && (
        <NewConsultationForm
          canDiagnosis={canDx}
          canTreatment={canTx}
          onSubmit={async (requestId, input) => {
            setError(null);
            setNotice(null);
            try {
              const result = await createConsultation(supabase, grantId, requestId, input);
              setNotice(result.duplicate ? "Esta consulta ya estaba registrada." : "Consulta registrada.");
              if (canRead) {
                await refreshHistory();
                setTab("history");
              }
              return true;
            } catch (e) {
              handleError(e);
              return false;
            }
          }}
        />
      )}
    </div>
  );
}

export function ConsultationCard({
  c,
  canAddendum,
  onAddendum,
}: {
  c: Consultation;
  canAddendum: boolean;
  onAddendum?: (requestId: string, body: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef(crypto.randomUUID());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || body.trim().length < 3 || !onAddendum) return;
    setBusy(true);
    const ok = await onAddendum(requestId.current, body.trim());
    setBusy(false);
    if (ok) {
      requestId.current = crypto.randomUUID();
      setBody("");
      setOpen(false);
    }
  }

  const vitals = [
    c.weightKg != null ? `Peso ${c.weightKg} kg` : null,
    c.temperatureC != null ? `Temp. ${c.temperatureC} °C` : null,
    c.heartRate != null ? `FC ${c.heartRate} lpm` : null,
    c.respiratoryRate != null ? `FR ${c.respiratoryRate} rpm` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={styles.consult}>
      <div className={styles.consultHead}>
        <span className={styles.consultDate}>{fmtDate(c.consultedAt)}</span>
        <span className={`${styles.badge} ${c.urgency === "routine" ? "" : styles.badgeWarn}`}>{URGENCY_LABELS[c.urgency]}</span>
      </div>
      <p className={styles.consultMeta}>{c.orgName ?? "Organización"} · {c.vetName ?? "Profesional"}{c.ownOrg ? " · tu organización" : ""}</p>
      <KV label="Motivo" value={c.reason} />
      <KV label="Signos vitales" value={vitals} />
      <KV label="Síntomas" value={c.symptoms} />
      <KV label="Examen físico" value={c.physicalExam} />
      <KV label="Diagnóstico" value={c.diagnosis} />
      <KV label="Tratamiento" value={c.treatment} />
      {c.medications.length > 0 && (
        <div className={styles.kv}>
          <span className={styles.kvLabel}>Medicamentos</span>
          <ul className={styles.meds}>
            {c.medications.map((m, i) => (
              <li key={i} className={styles.kvValue}>
                <strong>{m.name}</strong>
                {[m.dose != null ? `${m.dose} ${m.doseUnit ?? ""}`.trim() : null, m.frequency, m.route ? ROUTE_LABELS[m.route] : null, m.durationDays != null ? `${m.durationDays} días` : null]
                  .filter(Boolean)
                  .map((part) => ` · ${part}`)
                  .join("")}
                {m.instructions ? ` — ${m.instructions}` : ""}
                {m.startDate || m.endDate ? ` (${m.startDate ?? "?"} → ${m.endDate ?? "?"})` : ""}
                {m.notes ? ` · ${m.notes}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      <KV label="Recomendaciones" value={c.recommendations} />
      <KV label="Seguimiento" value={c.followUpDate ? fmtDate(c.followUpDate, false) : null} />
      <KV label="Observaciones finales" value={c.finalObservations} />
      {c.addenda.map((a) => (
        <div key={a.id} className={styles.addendum}>
          <strong>Aclaración</strong> · {fmtDate(a.createdAt)} · {a.orgName ?? "Organización"}: {a.body}
        </div>
      ))}
      {canAddendum && !open && (
        <div className={controls.buttonRow}>
          <button type="button" className={controls.buttonSecondary} onClick={() => setOpen(true)}>Añadir aclaración</button>
        </div>
      )}
      {open && (
        <form className={controls.sectionBody} onSubmit={submit}>
          <p className={styles.consultMeta}>La consulta original no se modifica: la aclaración queda como un registro aparte.</p>
          <textarea className={controls.textarea} value={body} maxLength={2000} rows={3} onChange={(e) => setBody(e.target.value)} required />
          <div className={controls.buttonRow}>
            <button type="submit" className={controls.button} disabled={busy || body.trim().length < 3}>{busy ? "Guardando…" : "Guardar aclaración"}</button>
            <button type="button" className={controls.buttonSecondary} onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </article>
  );
}

function NewConsultationForm({
  canDiagnosis,
  canTreatment,
  onSubmit,
}: {
  canDiagnosis: boolean;
  canTreatment: boolean;
  onSubmit: (requestId: string, input: Parameters<typeof createConsultation>[3]) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [weight, setWeight] = useState("");
  const [temp, setTemp] = useState("");
  const [hr, setHr] = useState("");
  const [rr, setRr] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [exam, setExam] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [recs, setRecs] = useState("");
  const [finalObs, setFinalObs] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("routine");
  const [followUp, setFollowUp] = useState("");
  const [meds, setMeds] = useState<MedicationInput[]>([]);
  const [busy, setBusy] = useState(false);
  // Un id por formulario: doble clic o reintento de red no crean otra consulta.
  const requestId = useRef(crypto.randomUUID());
  const busyRef = useRef(false);

  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

  function setMed(index: number, patch: Partial<MedicationInput>) {
    setMeds((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const ok = await onSubmit(requestId.current, {
      reason: reason.trim(),
      weightKg: num(weight),
      temperatureC: num(temp),
      heartRate: num(hr),
      respiratoryRate: num(rr),
      symptoms,
      physicalExam: exam,
      diagnosis: canDiagnosis ? diagnosis : undefined,
      treatment: canTreatment ? treatment : undefined,
      recommendations: recs,
      finalObservations: finalObs,
      urgency,
      followUpDate: followUp || null,
      medications: canTreatment ? meds : [],
    });
    busyRef.current = false;
    setBusy(false);
    if (ok) {
      requestId.current = crypto.randomUUID();
      setReason(""); setWeight(""); setTemp(""); setHr(""); setRr(""); setSymptoms(""); setExam("");
      setDiagnosis(""); setTreatment(""); setRecs(""); setFinalObs(""); setUrgency("routine"); setFollowUp(""); setMeds([]);
    }
  }

  return (
    <form className={controls.section} onSubmit={submit}>
      <h2 className={controls.sectionTitle}>Registrar consulta</h2>
      <div className={controls.sectionBody}>
        <label className={controls.field}>
          Motivo de la consulta
          <input className={controls.input} value={reason} maxLength={300} minLength={3} required onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className={controls.row2}>
          <label className={controls.field}>Peso (kg)
            <input className={controls.input} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <label className={controls.field}>Temperatura (°C)
            <input className={controls.input} inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} />
          </label>
          <label className={controls.field}>Frecuencia cardíaca (lpm)
            <input className={controls.input} inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} />
          </label>
          <label className={controls.field}>Frecuencia respiratoria (rpm)
            <input className={controls.input} inputMode="numeric" value={rr} onChange={(e) => setRr(e.target.value)} />
          </label>
        </div>
        <label className={controls.field}>Síntomas
          <textarea className={controls.textarea} value={symptoms} maxLength={2000} rows={2} onChange={(e) => setSymptoms(e.target.value)} />
        </label>
        <label className={controls.field}>Examen físico
          <textarea className={controls.textarea} value={exam} maxLength={2000} rows={2} onChange={(e) => setExam(e.target.value)} />
        </label>
        <label className={controls.field}>
          Diagnóstico {!canDiagnosis && <span className={controls.hint}>(tu autorización no incluye registrar diagnóstico)</span>}
          <textarea className={controls.textarea} value={diagnosis} maxLength={2000} rows={2} disabled={!canDiagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
        </label>
        <label className={controls.field}>
          Tratamiento {!canTreatment && <span className={controls.hint}>(tu autorización no incluye registrar tratamiento)</span>}
          <textarea className={controls.textarea} value={treatment} maxLength={2000} rows={2} disabled={!canTreatment} onChange={(e) => setTreatment(e.target.value)} />
        </label>

        {canTreatment && (
          <div className={controls.sectionBody}>
            <div className={controls.sectionHead}>
              <span className={controls.sectionTitle}>Medicamentos</span>
              <button type="button" className={controls.buttonSecondary} disabled={meds.length >= 20} onClick={() => setMeds((p) => [...p, emptyMed()])}>
                Añadir medicamento
              </button>
            </div>
            {meds.map((m, i) => (
              <div key={i} className={styles.medRow}>
                <label className={controls.field}>Nombre
                  <input className={controls.input} value={m.name} maxLength={100} onChange={(e) => setMed(i, { name: e.target.value })} />
                </label>
                <label className={controls.field}>Dosis
                  <input className={controls.input} inputMode="decimal" value={m.dose ?? ""} onChange={(e) => setMed(i, { dose: e.target.value })} />
                </label>
                <label className={controls.field}>Unidad
                  <input className={controls.input} value={m.dose_unit ?? ""} maxLength={20} placeholder="mg, ml…" onChange={(e) => setMed(i, { dose_unit: e.target.value })} />
                </label>
                <label className={controls.field}>Frecuencia
                  <input className={controls.input} value={m.frequency ?? ""} maxLength={80} placeholder="cada 12 h" onChange={(e) => setMed(i, { frequency: e.target.value })} />
                </label>
                <label className={controls.field}>Vía
                  <select className={controls.select} value={m.route ?? ""} onChange={(e) => setMed(i, { route: e.target.value })}>
                    <option value="">—</option>
                    {Object.entries(ROUTE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className={controls.field}>Duración (días)
                  <input className={controls.input} inputMode="numeric" value={m.duration_days ?? ""} onChange={(e) => setMed(i, { duration_days: e.target.value })} />
                </label>
                <label className={controls.field}>Inicio
                  <input className={controls.input} type="date" value={m.start_date ?? ""} onChange={(e) => setMed(i, { start_date: e.target.value })} />
                </label>
                <label className={controls.field}>Fin
                  <input className={controls.input} type="date" value={m.end_date ?? ""} onChange={(e) => setMed(i, { end_date: e.target.value })} />
                </label>
                <label className={`${controls.field} ${styles.medRowWide}`}>Indicaciones
                  <input className={controls.input} value={m.instructions ?? ""} maxLength={500} onChange={(e) => setMed(i, { instructions: e.target.value })} />
                </label>
                <label className={`${controls.field} ${styles.medRowWide}`}>Observaciones
                  <input className={controls.input} value={m.notes ?? ""} maxLength={300} onChange={(e) => setMed(i, { notes: e.target.value })} />
                </label>
                <div className={styles.medRowWide}>
                  <button type="button" className={controls.buttonDanger} onClick={() => setMeds((p) => p.filter((_, idx) => idx !== i))}>Quitar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <label className={controls.field}>Recomendaciones
          <textarea className={controls.textarea} value={recs} maxLength={2000} rows={2} onChange={(e) => setRecs(e.target.value)} />
        </label>
        <div className={controls.row2}>
          <label className={controls.field}>Urgencia
            <select className={controls.select} value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
              {Object.entries(URGENCY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className={controls.field}>Fecha de seguimiento
            <input className={controls.input} type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </label>
        </div>
        <label className={controls.field}>Observaciones finales
          <textarea className={controls.textarea} value={finalObs} maxLength={2000} rows={2} onChange={(e) => setFinalObs(e.target.value)} />
        </label>
        <p className={styles.consultMeta}>Las consultas no se pueden editar ni borrar; las correcciones se registran como aclaraciones.</p>
        <div className={controls.buttonRow}>
          <button type="submit" className={controls.button} disabled={busy}>{busy ? "Guardando…" : "Guardar consulta"}</button>
        </div>
      </div>
    </form>
  );
}
