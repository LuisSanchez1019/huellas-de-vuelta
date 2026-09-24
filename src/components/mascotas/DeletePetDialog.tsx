"use client";

import Modal from "@/components/ui/Modal";
import controls from "@/components/ui/controls.module.css";

export type DeleteBusy = null | "download" | "delete";

/**
 * Ventana propia (no `window.confirm`) para eliminar una mascota. Explica que se
 * pierde la historia clínica y ofrece descargar antes la información en PDF; la
 * descarga NO es obligatoria.
 */
export default function DeletePetDialog({
  open,
  petName,
  notes = [],
  busy,
  error,
  onDownloadAndDelete,
  onDeleteOnly,
  onCancel,
}: {
  open: boolean;
  petName: string;
  /** Avisos adicionales (reporte activo, placa que quedará libre…). */
  notes?: string[];
  busy: DeleteBusy;
  error: string | null;
  onDownloadAndDelete: () => void;
  onDeleteOnly: () => void;
  onCancel: () => void;
}) {
  const working = busy !== null;
  return (
    <Modal open={open} title={`Eliminar a ${petName}`} onClose={() => (working ? undefined : onCancel())}>
      <div className={controls.sectionBody}>
        <p style={{ lineHeight: 1.55 }}>
          Si eliminas esta mascota del sistema, perderás su historia clínica y toda la información registrada de ella.
        </p>
        <p style={{ lineHeight: 1.55, fontWeight: 700 }}>
          ¿Deseas descargar primero toda la información de la mascota en PDF?
        </p>
        {notes.map((note) => (
          <p key={note} className={controls.notice} style={{ margin: 0 }}>{note}</p>
        ))}
        {error && <p className={controls.errorText} role="alert">{error}</p>}
        <div className={controls.buttonRow}>
          <button type="button" className={controls.button} disabled={working} onClick={onDownloadAndDelete}>
            {busy === "download" ? "Generando PDF…" : busy === "delete" ? "Eliminando…" : "Descargar información y eliminar"}
          </button>
          <button type="button" className={controls.buttonDanger} disabled={working} onClick={onDeleteOnly}>
            {busy === "delete" ? "Eliminando…" : "Eliminar sin descargar"}
          </button>
          <button type="button" className={controls.buttonSecondary} disabled={working} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
