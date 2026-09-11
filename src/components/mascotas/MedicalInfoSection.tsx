"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  addMedicalItem,
  deleteMedicalItem,
  fetchMedicalItems,
  fetchMedicalSummary,
  medicalErrorMessage,
  saveMedicalSummary,
  updateMedicalItem,
  MEDICAL_LIMITS,
  MEDICAL_SOURCE_LABEL,
  type MedicalItem,
  type MedicalItemKind,
  type MedicalPetKind,
  type MedicalSummary,
} from "@/lib/supabase/petMedical";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "./medicalInfo.module.css";

const KIND_TITLE: Record<MedicalItemKind, string> = {
  condition: "Enfermedad o condición médica",
  allergy: "Alergia",
  medication: "Medicamento",
  urgent: "Medicamento o tratamiento urgente",
};

const KIND_QUESTION: Record<MedicalItemKind, string> = {
  condition: "¿Tiene alguna enfermedad o condición médica?",
  allergy: "¿Tiene alguna alergia?",
  medication: "¿Toma algún medicamento?",
  urgent: "¿Tiene algún medicamento o tratamiento urgente?",
};

const KIND_DETAIL_LABEL: Partial<Record<MedicalItemKind, string>> = {
  medication: "Información de uso",
  urgent: "Indicación importante",
};

type FlagKey = "hasCondition" | "hasAllergy" | "hasMedication" | "hasUrgent";
const KIND_FLAG: Record<MedicalItemKind, FlagKey> = {
  condition: "hasCondition",
  allergy: "hasAllergy",
  medication: "hasMedication",
  urgent: "hasUrgent",
};

export default function MedicalInfoSection({
  petKind,
  petId,
}: {
  petKind: MedicalPetKind;
  petId: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");
  const [summary, setSummary] = useState<MedicalSummary | null>(null);
  const [items, setItems] = useState<MedicalItem[]>([]);
  const [notes, setNotes] = useState("");
  const [flags, setFlags] = useState({
    hasCondition: false,
    hasAllergy: false,
    hasMedication: false,
    hasUrgent: false,
  });
  const [publicAlert, setPublicAlert] = useState(false);
  const [publicUrgent, setPublicUrgent] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const [s, list] = await Promise.all([
          fetchMedicalSummary(supabase, petKind, petId),
          fetchMedicalItems(supabase, petKind, petId),
        ]);
        setSummary(s);
        setItems(list);
        setNotes(s.notes ?? "");
        setFlags({
          hasCondition: s.hasCondition,
          hasAllergy: s.hasAllergy,
          hasMedication: s.hasMedication,
          hasUrgent: s.hasUrgent,
        });
        setPublicAlert(s.publicAlertEnabled);
        setPublicUrgent(s.publicUrgentEnabled);
        setState("ready");
      } catch {
        // Sin permiso de lectura (p. ej. no es el dueño): no mostrar la sección.
        setState("hidden");
      }
    });
  }, [petKind, petId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === "loading") {
    return <p className={controls.loading}>Cargando información médica…</p>;
  }
  if (state === "hidden" || !summary) {
    return null;
  }

  const canWrite = summary.canWrite;

  async function saveSummary() {
    setSavingSummary(true);
    try {
      await saveMedicalSummary(createSupabaseBrowserClient(), petKind, petId, {
        hasCondition: flags.hasCondition,
        hasAllergy: flags.hasAllergy,
        hasMedication: flags.hasMedication,
        hasUrgent: flags.hasUrgent,
        notes: notes.trim() || null,
        publicAlert,
        publicUrgent: publicUrgent && flags.hasUrgent,
      });
      setToast({ variant: "success", message: "Información médica guardada." });
      await load();
    } catch (error) {
      setToast({ variant: "error", message: medicalErrorMessage(error) });
    } finally {
      setSavingSummary(false);
    }
  }

  async function onItemsChanged() {
    setItems(await fetchMedicalItems(createSupabaseBrowserClient(), petKind, petId));
  }

  return (
    <section className={controls.section}>
      <p className={controls.sectionTitle}>Información médica</p>
      <div className={`${controls.sectionBody} ${styles.wrap}`}>
        {!canWrite && (
          <p className={styles.readonlyNote}>
            Solo lectura: no puedes modificar la información médica de esta mascota.
          </p>
        )}

        {(["condition", "allergy", "medication", "urgent"] as MedicalItemKind[]).map((kind) => (
          <MedicalGroup
            key={kind}
            kind={kind}
            active={flags[KIND_FLAG[kind]]}
            canWrite={canWrite}
            items={items.filter((item) => item.kind === kind)}
            petKind={petKind}
            petId={petId}
            onToggle={(value) => setFlags((prev) => ({ ...prev, [KIND_FLAG[kind]]: value }))}
            onChanged={onItemsChanged}
            onToast={setToast}
          />
        ))}

        <label className={controls.field}>
          Observaciones adicionales
          <textarea
            className={controls.textarea}
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, MEDICAL_LIMITS.notes))}
            maxLength={MEDICAL_LIMITS.notes}
            rows={3}
            disabled={!canWrite}
          />
          <span className={styles.counter}>
            {notes.length}/{MEDICAL_LIMITS.notes}
          </span>
        </label>

        <div className={styles.visibility}>
          <p className={styles.visTitle}>Visibilidad en el perfil público</p>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={publicAlert}
              onChange={(event) => setPublicAlert(event.target.checked)}
              disabled={!canWrite}
            />
            <span>
              Mostrar una alerta médica en el perfil público (“Esta mascota tiene una necesidad médica
              registrada”). No se publica ningún texto ni detalle.
            </span>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={publicUrgent}
              onChange={(event) => setPublicUrgent(event.target.checked)}
              disabled={!canWrite || !flags.hasUrgent}
            />
            <span>
              Además, indicar públicamente que “requiere medicamento urgente” (solo si arriba marcaste
              que sí tiene un tratamiento urgente).
            </span>
          </label>
        </div>

        {canWrite && (
          <div className={controls.buttonRow}>
            <button
              type="button"
              className={controls.button}
              onClick={saveSummary}
              disabled={savingSummary}
            >
              {savingSummary ? "Guardando…" : "Guardar información médica"}
            </button>
          </div>
        )}
      </div>

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function MedicalGroup({
  kind,
  active,
  canWrite,
  items,
  petKind,
  petId,
  onToggle,
  onChanged,
  onToast,
}: {
  kind: MedicalItemKind;
  active: boolean;
  canWrite: boolean;
  items: MedicalItem[];
  petKind: MedicalPetKind;
  petId: string;
  onToggle: (value: boolean) => void;
  onChanged: () => void;
  onToast: (toast: ToastState) => void;
}) {
  const limits = MEDICAL_LIMITS[kind];
  const detailLabel = KIND_DETAIL_LABEL[kind];
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDetail, setEditDetail] = useState("");

  async function add() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await addMedicalItem(
        createSupabaseBrowserClient(),
        petKind,
        petId,
        kind,
        label.trim(),
        detailLabel ? detail.trim() || null : null,
      );
      setLabel("");
      setDetail("");
      onChanged();
    } catch (error) {
      onToast({ variant: "error", message: medicalErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editLabel.trim()) return;
    setBusy(true);
    try {
      await updateMedicalItem(
        createSupabaseBrowserClient(),
        id,
        editLabel.trim(),
        detailLabel ? editDetail.trim() || null : null,
      );
      setEditingId(null);
      onChanged();
    } catch (error) {
      onToast({ variant: "error", message: medicalErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("¿Eliminar este registro médico?")) return;
    setBusy(true);
    try {
      await deleteMedicalItem(createSupabaseBrowserClient(), id);
      onChanged();
    } catch (error) {
      onToast({ variant: "error", message: medicalErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.question}>
      <p className={styles.groupTitle}>{KIND_QUESTION[kind]}</p>
      <div className={styles.yesno}>
        <button
          type="button"
          className={active ? styles.yesnoBtnOn : styles.yesnoBtn}
          onClick={() => onToggle(true)}
          disabled={!canWrite}
        >
          Sí
        </button>
        <button
          type="button"
          className={!active ? styles.yesnoBtnOn : styles.yesnoBtn}
          onClick={() => onToggle(false)}
          disabled={!canWrite}
        >
          No
        </button>
      </div>

      {active && (
        <>
          {items.length > 0 && (
            <div className={styles.items}>
              {items.map((item) => (
                <div key={item.id} className={styles.item}>
                  {editingId === item.id ? (
                    <>
                      <input
                        className={controls.input}
                        value={editLabel}
                        maxLength={limits.label}
                        onChange={(event) => setEditLabel(event.target.value.slice(0, limits.label))}
                      />
                      {detailLabel && (
                        <input
                          className={controls.input}
                          value={editDetail}
                          maxLength={limits.detail}
                          placeholder={detailLabel}
                          onChange={(event) => setEditDetail(event.target.value.slice(0, limits.detail))}
                        />
                      )}
                      <div className={styles.itemActions}>
                        <button type="button" className={styles.itemBtn} disabled={busy} onClick={() => saveEdit(item.id)}>
                          Guardar
                        </button>
                        <button type="button" className={styles.itemBtn} onClick={() => setEditingId(null)}>
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.itemHead}>
                        <span className={styles.itemLabel}>{item.label}</span>
                        <span className={styles.sourceTag}>{MEDICAL_SOURCE_LABEL[item.source]}</span>
                      </div>
                      {item.detail && <span className={styles.itemDetail}>{item.detail}</span>}
                      {item.canEdit && (
                        <div className={styles.itemActions}>
                          <button
                            type="button"
                            className={styles.itemBtn}
                            onClick={() => {
                              setEditingId(item.id);
                              setEditLabel(item.label);
                              setEditDetail(item.detail ?? "");
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={`${styles.itemBtn} ${styles.itemBtnDanger}`}
                            disabled={busy}
                            onClick={() => remove(item.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {canWrite && (
            <div className={styles.addRow}>
              <input
                className={controls.input}
                value={label}
                maxLength={limits.label}
                placeholder={KIND_TITLE[kind]}
                onChange={(event) => setLabel(event.target.value.slice(0, limits.label))}
              />
              <span className={styles.counter}>
                {label.length}/{limits.label}
              </span>
              {detailLabel && (
                <>
                  <input
                    className={controls.input}
                    value={detail}
                    maxLength={limits.detail}
                    placeholder={detailLabel}
                    onChange={(event) => setDetail(event.target.value.slice(0, limits.detail))}
                  />
                  <span className={styles.counter}>
                    {detail.length}/{limits.detail}
                  </span>
                </>
              )}
              <div className={controls.buttonRow}>
                <button
                  type="button"
                  className={controls.buttonSecondary}
                  disabled={busy || !label.trim()}
                  onClick={add}
                >
                  Añadir
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
