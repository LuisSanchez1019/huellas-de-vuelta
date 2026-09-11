"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { resolvePanelSession } from "@/lib/auth/session";
import { fetchOrgProfileRow, type OrgProfileKind } from "@/lib/supabase/orgProfiles";
import {
  fetchOrgDeliveryEvents,
  fetchOrgPetOwnerContact,
  orgConfirmPetReceipt,
  type OrgPetOwnerContact,
} from "@/lib/supabase/reportEvents";
import { getPetPhotoSignedUrl } from "@/lib/supabase/pets";
import { orgDeliveryEventStatus, orgDeliveryStatusLabels, petConditionLabels, type OrgDeliveryEvent } from "@/lib/pets/reencuentro";
import { speciesLabels } from "@/lib/pets/labels";
import { AlertIcon, CheckIcon, ClockIcon, CrossIcon, PawIcon, PinIcon } from "@/components/icons/Icon";
import Toast, { type ToastState } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import controls from "@/components/ui/controls.module.css";
import styles from "./petDeliveryPanel.module.css";

const THREE_HOURS_MS = 3 * 3_600_000;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: styles.badgePending,
  received: styles.badgeReceived,
  declined: styles.badgeDeclined,
};

/**
 * "Recepción de mascotas": avisos "necesita ayuda" que eligieron esta
 * organización. Vive dentro del Dashboard existente de veterinaria/fundación
 * (no es una app aparte). Los datos vienen de la RPC `list_org_delivery_events`
 * (no una política RLS de fila completa) — nunca expone el contacto de quien
 * reportó, ni siquiera a nivel de base de datos.
 */
export default function PetDeliveryPanel({ kind }: { kind: OrgProfileKind }) {
  const [state, setState] = useState<"loading" | "ready" | "no-org" | "error">("loading");
  const [events, setEvents] = useState<OrgDeliveryEvent[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ event: OrgDeliveryEvent; received: boolean } | null>(null);
  const [contacts, setContacts] = useState<Record<string, OrgPetOwnerContact | "loading">>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  // Se lee una sola vez (no en cada render) para decidir si mostrar el aviso
  // de "espera 3 horas" — no hace falta que se actualice en tiempo real.
  const [now] = useState(() => Date.now());

  const load = useCallback(() => {
    return (async () => {
      setState("loading");
      try {
        const check = await resolvePanelSession();
        if (check.status === "unauthenticated") {
          setState("no-org");
          return;
        }
        const supabase = createSupabaseBrowserClient();
        const row = await fetchOrgProfileRow(kind, check.session.userId);
        if (!row) {
          setState("no-org");
          return;
        }
        const rows = await fetchOrgDeliveryEvents(supabase);
        setEvents(rows);

        const entries = await Promise.all(
          rows
            .filter((ev) => ev.pet.photo_path)
            .map(async (ev) => [ev.id, await getPetPhotoSignedUrl(supabase, ev.pet.photo_path as string)] as const),
        );
        setPhotoUrls(Object.fromEntries(entries.filter((e): e is [string, string] => e[1] !== null)));
        setState("ready");
      } catch {
        setState("error");
      }
    })();
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond() {
    if (!confirming) return;
    const { event, received } = confirming;
    setBusyId(event.id);
    setConfirming(null);
    try {
      const supabase = createSupabaseBrowserClient();
      await orgConfirmPetReceipt(supabase, event.id, received);
      setToast({
        variant: "success",
        message: received ? "Marcada como recibida. Se avisó al propietario." : "Marcada como no recibida.",
      });
      await load();
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible actualizar el aviso.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function loadOwnerContact(eventId: string) {
    setContacts((cur) => ({ ...cur, [eventId]: "loading" }));
    try {
      const result = await fetchOrgPetOwnerContact(createSupabaseBrowserClient(), eventId);
      setContacts((cur) => ({ ...cur, [eventId]: result }));
    } catch {
      setContacts((cur) => {
        const next = { ...cur };
        delete next[eventId];
        return next;
      });
      setToast({ variant: "error", message: "No fue posible consultar el contacto del propietario." });
    }
  }

  if (state === "loading") return <p className={controls.loading}>Cargando avisos…</p>;
  if (state === "no-org") {
    return <p className={controls.empty}>Crea el perfil de tu organización para ver avisos aquí.</p>;
  }
  if (state === "error") return <p className={controls.empty}>No fue posible cargar los avisos.</p>;
  if (events.length === 0) {
    return (
      <p className={controls.empty}>
        Todavía no hay avisos de mascotas que planeen traer a tu organización.
      </p>
    );
  }

  return (
    <>
      <ul className={styles.list}>
        {events.map((ev) => {
          const status = orgDeliveryEventStatus(ev);
          const pet = ev.pet;
          const showWaitNotice =
            status === "pending" && ev.selectedOrgAt && now - new Date(ev.selectedOrgAt).getTime() < THREE_HOURS_MS;
          return (
            <li key={ev.id} className={styles.item}>
              <div className={styles.itemHead}>
                {photoUrls[ev.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                  <img src={photoUrls[ev.id]} alt={pet.name || "Mascota"} className={styles.thumb} />
                ) : (
                  <span className={styles.thumbPlaceholder} aria-hidden="true"><PawIcon size={24} /></span>
                )}
                <div className={styles.body}>
                  <div className={styles.top}>
                    <span className={styles.name}>{pet.name || "Mascota"}</span>
                    <span className={`${styles.badge} ${STATUS_BADGE_CLASS[status]}`}>
                      {orgDeliveryStatusLabels[status]}
                    </span>
                  </div>
                  <p className={styles.meta}>
                    {pet.species === "other" ? pet.species_other || "Otro" : speciesLabels[pet.species as keyof typeof speciesLabels]}
                    {pet.breed ? ` · ${pet.breed}` : ""}
                  </p>
                  <p className={styles.loc}>
                    <PinIcon size={13} className={styles.locIcon} />
                    {ev.city} · {ev.neighborhood}
                  </p>
                  <p className={styles.date}>
                    <ClockIcon size={13} className={styles.locIcon} />
                    Aviso del {ev.selectedOrgAt ? formatDateTime(ev.selectedOrgAt) : ""}
                  </p>
                </div>
              </div>

              {ev.petCondition && (
                <p className={styles.detail}>Estado de la mascota: {petConditionLabels[ev.petCondition]}</p>
              )}
              {ev.description && <p className={styles.detail}>{ev.description}</p>}
              <p className={styles.reporter}>Quién reportó: usuario anónimo</p>

              {showWaitNotice && (
                <p className={styles.waitNotice}>
                  <AlertIcon size={16} className={styles.waitIcon} />
                  <span>
                    <strong>Espera antes de confirmar la recepción.</strong> No selecciones ninguna opción
                    hasta confirmar que la mascota realmente fue entregada. Se recomienda esperar un mínimo
                    de 3 horas desde el aviso, ya que el usuario puede tardar en llegar.
                  </span>
                </p>
              )}

              {status === "pending" && (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.receiveButton}
                    disabled={busyId === ev.id}
                    onClick={() => setConfirming({ event: ev, received: true })}
                  >
                    <CheckIcon size={15} /> Recibí la mascota
                  </button>
                  <button
                    type="button"
                    className={styles.declineButton}
                    disabled={busyId === ev.id}
                    onClick={() => setConfirming({ event: ev, received: false })}
                  >
                    <CrossIcon size={15} /> No recibí la mascota
                  </button>
                </div>
              )}

              {status === "received" && (() => {
                const contact = contacts[ev.id];
                if (!contact) {
                  return (
                    <button type="button" className={styles.contactButton} onClick={() => loadOwnerContact(ev.id)}>
                      Ver datos de contacto del propietario
                    </button>
                  );
                }
                if (contact === "loading") {
                  return <p className={styles.detail}>Consultando…</p>;
                }
                if (!contact.authorized) {
                  return (
                    <p className={styles.contactNote}>
                      El propietario no autorizó compartir sus datos de contacto. Espera a que se
                      comunique contigo tras la notificación de recepción.
                    </p>
                  );
                }
                return (
                  <div className={styles.contactBox}>
                    <p className={styles.contactTitle}>Contacto del propietario (autorizado)</p>
                    {contact.ownerName && <p className={styles.detail}>{contact.ownerName}</p>}
                    {contact.ownerPhone && <p className={styles.detail}>Teléfono: {contact.ownerPhone}</p>}
                    {contact.ownerPhoneAlt && <p className={styles.detail}>Teléfono alterno: {contact.ownerPhoneAlt}</p>}
                    {contact.ownerEmail && <p className={styles.detail}>Correo: {contact.ownerEmail}</p>}
                  </div>
                );
              })()}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming?.received ? "Confirmar recepción" : "Confirmar que no la has recibido"}
        message={
          confirming?.received
            ? `Vas a marcar a «${confirming.event.pet.name || "la mascota"}» como recibida. Se notificará al propietario de inmediato.`
            : confirming
              ? `Vas a indicar que todavía no has recibido a «${confirming.event.pet.name || "la mascota"}». El propietario será informado.`
              : ""
        }
        confirmLabel={confirming?.received ? "Sí, la recibí" : "Sí, aún no la recibo"}
        cancelLabel="Cancelar"
        onConfirm={respond}
        onCancel={() => setConfirming(null)}
      />

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
