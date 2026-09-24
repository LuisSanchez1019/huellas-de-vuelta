"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDateLong, todayLocal } from "@/lib/pets/age";
import {
  VACCINATION_LIMITS,
  addVaccination,
  deleteVaccination,
  fetchVaccinations,
  updateVaccination,
  vaccinationErrorMessage,
  type Vaccination,
  type VaccinationInput,
} from "@/lib/supabase/petVaccinations";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "./medicalInfo.module.css";

const EMPTY: VaccinationInput = {
  vaccineName: "",
  applicationDate: "",
  nextDoseDate: "",
  lotNumber: "",
  veterinaryName: "",
  notes: "",
};

/**
 * Sección "Vacunación" de la ficha de la mascota (propietario). La autorización real
 * está en el servidor (RPC `pet_vaccination_*` + RLS); ocultar botones no es la
 * seguridad. Sin `alert()`/`confirm()`: usa los diálogos propios.
 */
export default function VaccinationSection({ petId, birthDate }: { petId: string; birthDate: string | null }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [items, setItems] = useState<Vaccination[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<VaccinationInput>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Vaccination | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const lock = useRef(false);
  const today = todayLocal();

  const reload = useCallback(async () => {
    try {
      setItems(await fetchVaccinations(supabase, petId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [supabase, petId]);

  useEffect(() => {
    let alive = true;
    fetchVaccinations(supabase, petId)
      .then((list) => {
        if (alive) setItems(list);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [supabase, petId]);

  function set<K extends keyof VaccinationInput>(key: K, value: VaccinationInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startAdd() {
    setForm(EMPTY);
    setFormError(null);
    setEditingId("new");
  }

  function startEdit(item: Vaccination) {
    setForm({
      vaccineName: item.vaccineName,
      applicationDate: item.applicationDate,
      nextDoseDate: item.nextDoseDate ?? "",
      lotNumber: item.lotNumber ?? "",
      veterinaryName: item.veterinaryName ?? "",
      notes: item.notes ?? "",
    });
    setFormError(null);
    setEditingId(item.id);
  }

  function cancelForm() {
    setEditingId(null);
    setFormError(null);
  }

  function validate(): string | null {
    if (form.vaccineName.trim().length < 2) return "Escribe el nombre de la vacuna.";
    if (!form.applicationDate) return "Indica la fecha de aplicación.";
    if (form.applicationDate > today) return "La fecha de aplicación no puede ser futura.";
    if (birthDate && form.applicationDate < birthDate) return "La aplicación no puede ser anterior al nacimiento.";
    if (form.nextDoseDate && form.nextDoseDate < form.applicationDate) {
      return "La próxima dosis debe ser posterior a la fecha de aplicación.";
    }
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }
    lock.current = true;
    setBusy(true);
    setFormError(null);
    try {
      if (editingId === "new") await addVaccination(supabase, petId, form);
      else if (editingId) await updateVaccination(supabase, editingId, form);
      setToast({ variant: "success", message: editingId === "new" ? "Vacuna agregada." : "Vacuna actualizada." });
      setEditingId(null);
      await reload();
    } catch (error) {
      setFormError(vaccinationErrorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteVaccination(supabase, target.id);
      setToast({ variant: "success", message: "Vacuna eliminada." });
      await reload();
    } catch (error) {
      setToast({ variant: "error", message: vaccinationErrorMessage(error) });
    }
  }

  return (
    <section className={controls.section}>
      <p className={controls.sectionTitle}>Vacunación</p>
      <div className={`${controls.sectionBody} ${styles.wrap}`}>
        {failed && <p className={controls.errorText}>No fue posible cargar las vacunas.</p>}
        {items === null && !failed && <p className={controls.loading}>Cargando…</p>}
        {items?.length === 0 && editingId === null && (
          <p className={styles.itemDetail}>Todavía no hay vacunas registradas.</p>
        )}

        {items && items.length > 0 && (
          <div className={styles.items}>
            {items.map((item) => (
              <div key={item.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.itemLabel}>{item.vaccineName}</span>
                  <span className={styles.itemActions}>
                    <button type="button" className={styles.itemBtn} onClick={() => startEdit(item)} disabled={busy}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className={`${styles.itemBtn} ${styles.itemBtnDanger}`}
                      onClick={() => setPendingDelete(item)}
                      disabled={busy}
                    >
                      Eliminar
                    </button>
                  </span>
                </div>
                <span className={styles.itemDetail}>Aplicada: {formatDateLong(item.applicationDate)}</span>
                {item.nextDoseDate && (
                  <span className={styles.itemDetail}>Próxima dosis: {formatDateLong(item.nextDoseDate)}</span>
                )}
                {(item.lotNumber || item.veterinaryName) && (
                  <span className={styles.itemDetail}>
                    {[item.lotNumber ? `Lote ${item.lotNumber}` : null, item.veterinaryName].filter(Boolean).join(" · ")}
                  </span>
                )}
                {item.notes && <span className={styles.itemDetail}>{item.notes}</span>}
              </div>
            ))}
          </div>
        )}

        {editingId !== null ? (
          <form className={styles.addRow} onSubmit={submit}>
            <label className={controls.field}>
              Vacuna
              <input
                className={controls.input}
                value={form.vaccineName}
                maxLength={VACCINATION_LIMITS.name}
                onChange={(e) => set("vaccineName", e.target.value)}
                placeholder="Ej. Rabia, Parvovirus, Triple felina"
              />
            </label>
            <div className={controls.row2}>
              <label className={controls.field}>
                Fecha de aplicación
                <input
                  className={controls.input}
                  type="date"
                  value={form.applicationDate}
                  min={birthDate ?? "1980-01-01"}
                  max={today}
                  onChange={(e) => set("applicationDate", e.target.value)}
                />
              </label>
              <label className={controls.field}>
                Próxima dosis (opcional)
                <input
                  className={controls.input}
                  type="date"
                  value={form.nextDoseDate}
                  min={form.applicationDate || undefined}
                  onChange={(e) => set("nextDoseDate", e.target.value)}
                />
              </label>
            </div>
            <div className={controls.row2}>
              <label className={controls.field}>
                Lote (opcional)
                <input
                  className={controls.input}
                  value={form.lotNumber}
                  maxLength={VACCINATION_LIMITS.lot}
                  onChange={(e) => set("lotNumber", e.target.value)}
                />
              </label>
              <label className={controls.field}>
                Veterinaria o profesional (opcional)
                <input
                  className={controls.input}
                  value={form.veterinaryName}
                  maxLength={VACCINATION_LIMITS.veterinary}
                  onChange={(e) => set("veterinaryName", e.target.value)}
                />
              </label>
            </div>
            <label className={controls.field}>
              Notas (opcional)
              <textarea
                className={controls.textarea}
                rows={2}
                value={form.notes}
                maxLength={VACCINATION_LIMITS.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </label>
            {formError && <p className={controls.errorText} role="alert">{formError}</p>}
            <div className={controls.buttonRow}>
              <button type="submit" className={controls.button} disabled={busy}>
                {busy ? "Guardando…" : editingId === "new" ? "Agregar vacuna" : "Guardar cambios"}
              </button>
              <button type="button" className={controls.buttonSecondary} onClick={cancelForm} disabled={busy}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className={controls.buttonRow}>
            <button type="button" className={controls.buttonSecondary} onClick={startAdd} disabled={items === null}>
              Agregar vacuna
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar vacuna"
        message={pendingDelete ? `Se eliminará el registro de «${pendingDelete.vaccineName}». Esta acción no se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </section>
  );
}
