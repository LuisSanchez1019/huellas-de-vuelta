"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getPetPhotoSignedUrl } from "@/lib/supabase/pets";
import { deleteMyClosedReports, fetchMyReports, setPetStatus } from "@/lib/supabase/reports";
import { notifyNotificationsChanged } from "@/lib/notifications/events";
import {
  acknowledgeReportEvent,
  fetchEventsForMyReports,
  getReportEvidenceSignedUrl,
} from "@/lib/supabase/reportEvents";
import { reportStatusLabels, type PetReport, type PetReportStatus } from "@/lib/pets/reports";
import {
  eventTypeLabels,
  orgDeliveryStatus,
  petConditionLabels,
  reportStageLabels,
  type ReportEvent,
  type ReportStage,
} from "@/lib/pets/reencuentro";
import { speciesLabels } from "@/lib/pets/labels";
import { PawIcon, PinIcon } from "@/components/icons/Icon";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "./reportsList.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

const EVENT_BADGE_CLASS: Record<ReportEvent["type"], string> = {
  sighting: styles.evBadgeSighting,
  found: styles.evBadgeFound,
  found_needs_help: styles.evBadgeHelp,
};

export default function ReportsList({ status }: { status: PetReportStatus }) {
  const [state, setState] = useState<"loading" | "ready" | "no-session" | "error">("loading");
  const [reports, setReports] = useState<PetReport[]>([]);
  const [events, setEvents] = useState<Record<string, ReportEvent[]>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<PetReport | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = status === "closed";

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      setState("loading");
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setState("no-session");
        return;
      }
      try {
        const [rows, eventRows] = await Promise.all([
          fetchMyReports(supabase, status),
          fetchEventsForMyReports(supabase, status),
        ]);
        setReports(rows);
        setSelected(new Set());

        const byReport: Record<string, ReportEvent[]> = {};
        for (const ev of eventRows) (byReport[ev.report_id] ||= []).push(ev);
        setEvents(byReport);

        const petEntries = await Promise.all(
          rows
            .filter((report) => report.pet?.photo_path)
            .map(async (report) =>
              [report.id, await getPetPhotoSignedUrl(supabase, report.pet!.photo_path as string)] as const,
            ),
        );
        setPhotoUrls(Object.fromEntries(petEntries.filter((e): e is [string, string] => e[1] !== null)));

        const evidenceEntries = await Promise.all(
          eventRows
            .filter((ev) => ev.photo_path)
            .map(async (ev) =>
              [ev.id, await getReportEvidenceSignedUrl(supabase, ev.photo_path as string)] as const,
            ),
        );
        setEvidenceUrls(Object.fromEntries(evidenceEntries.filter((e): e is [string, string] => e[1] !== null)));

        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleOne(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(allIds: string[]) {
    setSelected((cur) => (cur.size === allIds.length ? new Set() : new Set(allIds)));
  }

  async function confirmDelete() {
    if (!pendingDelete || pendingDelete.length === 0) return;
    setIsDeleting(true);
    try {
      const removed = await deleteMyClosedReports(createSupabaseBrowserClient(), pendingDelete);
      setReports((cur) => cur.filter((r) => !pendingDelete.includes(r.id)));
      setSelected(new Set());
      setPendingDelete(null);
      notifyNotificationsChanged();
      setToast({
        variant: "success",
        message: removed === 1 ? "Reporte eliminado del historial." : `${removed} reportes eliminados del historial.`,
      });
    } catch {
      setToast({ variant: "error", message: "No fue posible eliminar los reportes." });
    } finally {
      setIsDeleting(false);
    }
  }

  async function markSeen(eventId: string) {
    const supabase = createSupabaseBrowserClient();
    try {
      await acknowledgeReportEvent(supabase, eventId);
      setEvents((current) => {
        const next: Record<string, ReportEvent[]> = {};
        for (const [rid, list] of Object.entries(current)) {
          next[rid] = list.map((ev) =>
            ev.id === eventId ? { ...ev, acknowledged_at: new Date().toISOString() } : ev,
          );
        }
        return next;
      });
    } catch {
      setToast({ variant: "error", message: "No fue posible marcar el aviso como visto." });
    }
  }

  async function confirmResolve() {
    if (!resolving) return;
    setIsResolving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await setPetStatus(supabase, resolving.pet_id, "at_home");
      setToast({ variant: "success", message: `«${resolving.pet?.name ?? "Tu mascota"}» está en casa. El reporte pasó al historial.` });
      setResolving(null);
      await load();
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible cerrar el reporte.",
      });
    } finally {
      setIsResolving(false);
    }
  }

  if (state === "loading") return <p className={controls.loading}>Cargando reportes…</p>;
  if (state === "no-session") {
    return <p className={controls.empty}>Inicia sesión con una cuenta real para ver tus reportes.</p>;
  }
  if (state === "error") {
    return <p className={controls.empty}>No fue posible cargar los reportes.</p>;
  }
  if (reports.length === 0) {
    return (
      <p className={controls.empty}>
        {status === "active"
          ? "No tienes reportes de mascota perdida activos."
          : "Todavía no hay reportes cerrados en tu historial."}
      </p>
    );
  }

  const allIds = reports.map((r) => r.id);

  return (
    <>
      {canDelete && (
        <div className={styles.bulkBar}>
          <label className={styles.bulkSelect}>
            <input
              type="checkbox"
              checked={selected.size === allIds.length && allIds.length > 0}
              onChange={() => toggleAll(allIds)}
              aria-label="Seleccionar todos"
            />
            {selected.size > 0 ? `${selected.size} seleccionados` : "Seleccionar todos"}
          </label>
          {selected.size > 0 && (
            <button
              type="button"
              className={styles.bulkDelete}
              disabled={isDeleting}
              onClick={() => setPendingDelete([...selected])}
            >
              Eliminar seleccionados ({selected.size})
            </button>
          )}
        </div>
      )}

      <ul className={styles.list}>
        {reports.map((report) => {
          const pet = report.pet;
          const reportEvents = events[report.id] ?? [];
          return (
            <li key={report.id} className={styles.item}>
              <div className={styles.itemHead}>
                {canDelete && (
                  <input
                    type="checkbox"
                    className={styles.itemCheck}
                    checked={selected.has(report.id)}
                    onChange={() => toggleOne(report.id)}
                    aria-label={`Seleccionar reporte de ${pet?.name ?? "mascota"}`}
                  />
                )}
                {photoUrls[report.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                  <img src={photoUrls[report.id]} alt={pet?.name ?? "Mascota"} className={styles.thumb} />
                ) : (
                  <span className={styles.thumbPlaceholder} aria-hidden="true"><PawIcon size={24} /></span>
                )}
                <div className={styles.body}>
                  <div className={styles.top}>
                    <span className={styles.name}>{pet?.name ?? "Mascota"}</span>
                    <span className={`${styles.badge} ${report.status === "active" ? styles.badgeActive : styles.badgeClosed}`}>
                      {reportStatusLabels[report.status]}
                    </span>
                  </div>
                  <p className={styles.meta}>
                    {pet ? (pet.species === "other" ? pet.species_other || "Otro" : speciesLabels[pet.species]) : ""}
                    {pet?.breed ? ` · ${pet.breed}` : ""}
                    {report.status === "active" ? ` · ${reportStageLabels[(report.stage ?? "reported") as ReportStage]}` : ""}
                  </p>
                  <p className={styles.loc}>
                    <PinIcon size={13} className={styles.locIcon} />
                    {report.city} · {report.neighborhood}
                  </p>
                  {report.details && <p className={styles.details}>{report.details}</p>}
                  <p className={styles.date}>
                    Reportada el {formatDate(report.created_at)}
                    {report.closed_at ? ` · Cerrada el ${formatDate(report.closed_at)}` : ""}
                  </p>
                </div>
              </div>

              {reportEvents.length > 0 && (
                <div className={styles.events}>
                  <p className={styles.eventsTitle}>Avisos recibidos ({reportEvents.length})</p>
                  {reportEvents.map((ev) => (
                    <div key={ev.id} className={styles.event}>
                      <div className={styles.eventTop}>
                        <span className={`${styles.evBadge} ${EVENT_BADGE_CLASS[ev.type]}`}>
                          {eventTypeLabels[ev.type]}
                        </span>
                        <span className={styles.evDate}>{formatDate(ev.created_at)}</span>
                      </div>
                      <p className={styles.evLine}>
                        <PinIcon size={12} className={styles.locIcon} />
                        {ev.city} · {ev.neighborhood}
                        {ev.happened_on ? ` · ${formatDate(ev.happened_on)}` : ""}
                        {ev.happened_at_approx ? ` · ${ev.happened_at_approx}` : ""}
                      </p>
                      {ev.pet_condition && (
                        <p className={styles.evLine}>Estado: {petConditionLabels[ev.pet_condition]}</p>
                      )}
                      {ev.description && <p className={styles.evDesc}>{ev.description}</p>}
                      {(ev.type === "found" || ev.type === "found_needs_help") && (
                        <p className={styles.evContact}>
                          <strong>Tiene la mascota.</strong>{" "}
                          {ev.finder_name ? `${ev.finder_name} — ` : ""}
                          {ev.finder_contact ?? "Sin contacto"}
                        </p>
                      )}
                      {ev.selected_org && (
                        <>
                          <p className={styles.evLine}>
                            Piensa llevarla a: <strong>{ev.selected_org.name}</strong>
                            {ev.selected_org.city ? ` (${ev.selected_org.city})` : ""}
                          </p>
                          {orgDeliveryStatus(ev) === "received" && (
                            <p className={styles.evDeliveryReceived}>
                              <strong>¡Ven por tu mascota!</strong> {ev.selected_org.name} confirmó que la
                              recibió{ev.org_received_at ? ` el ${formatDate(ev.org_received_at)}` : ""}.
                              Contáctala para coordinar cómo recogerla.
                            </p>
                          )}
                          {orgDeliveryStatus(ev) === "declined" && (
                            <p className={styles.evDeliveryDeclined}>
                              {ev.selected_org.name} indicó que todavía no ha recibido a tu mascota.
                            </p>
                          )}
                          {orgDeliveryStatus(ev) === "pending" && (
                            <p className={styles.evDeliveryPending}>
                              Pendiente de entrega: esto no significa que {ev.selected_org.name} ya la
                              recibió. Te avisaremos cuando lo confirmen.
                            </p>
                          )}
                        </>
                      )}
                      {evidenceUrls[ev.id] && (
                        // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                        <img src={evidenceUrls[ev.id]} alt="Foto del aviso" className={styles.evPhoto} />
                      )}
                      {!ev.acknowledged_at ? (
                        <button type="button" className={styles.evSeen} onClick={() => markSeen(ev.id)}>
                          Marcar como visto
                        </button>
                      ) : (
                        <span className={styles.evSeenDone}>Visto</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {report.status === "active" && (
                <button type="button" className={styles.resolveButton} onClick={() => setResolving(report)}>
                  <PawIcon size={16} />
                  Ya encontré a mi mascota
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className={styles.deleteButton}
                  disabled={isDeleting}
                  onClick={() => setPendingDelete([report.id])}
                >
                  Eliminar del historial
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar del historial"
        message={
          pendingDelete && pendingDelete.length === 1
            ? "Se eliminará este reporte cerrado y sus avisos asociados. Esta acción no se puede deshacer."
            : `Se eliminarán ${pendingDelete?.length ?? 0} reportes cerrados y sus avisos. Esta acción no se puede deshacer.`
        }
        confirmLabel={isDeleting ? "Eliminando…" : "Sí, eliminar"}
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(resolving)}
        title="Confirmar reencuentro"
        message={
          resolving
            ? `«${resolving.pet?.name ?? "Tu mascota"}» pasará a estado «En casa» y su reporte se cerrará. Los avisos recibidos se conservan en el historial.`
            : ""
        }
        confirmLabel={isResolving ? "Guardando…" : "Sí, ya está en casa"}
        cancelLabel="Cancelar"
        onConfirm={confirmResolve}
        onCancel={() => setResolving(null)}
      />

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
