"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  adminListOrganizations,
  setOrgActive,
  setOrgApproval,
  setProviderQrPrefix,
  type AdminOrganization,
} from "@/lib/supabase/orgAdmin";
import { orgApprovalLabels, orgCategoryLabels, type OrgApprovalStatus } from "@/lib/pets/reencuentro";
import PromptDialog from "@/components/ui/PromptDialog";
import Toast, { type ToastState } from "@/components/ui/Toast";
import { TableSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";
import styles from "./organizaciones.module.css";

type Tab = "pending" | "approved" | "rejected";

const TAB_LABEL: Record<Tab, string> = {
  pending: "Pendientes",
  approved: "Aprobadas",
  rejected: "Rechazadas",
};

export default function AdminOrganizacionesPage() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingReject, setPendingReject] = useState<AdminOrganization | null>(null);
  const [qrPrefixInputs, setQrPrefixInputs] = useState<Record<string, string>>({});
  const [savingPrefixId, setSavingPrefixId] = useState<string | null>(null);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        setOrgs(await adminListOrganizations(supabase));
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      pending: orgs.filter((o) => o.approvalStatus === "pending").length,
      approved: orgs.filter((o) => o.approvalStatus === "approved").length,
      rejected: orgs.filter((o) => o.approvalStatus === "rejected").length,
    }),
    [orgs],
  );

  const visible = orgs.filter((o) => o.approvalStatus === tab);

  async function decide(org: AdminOrganization, status: OrgApprovalStatus) {
    if (status === "rejected") {
      setPendingReject(org);
      return;
    }
    await runDecide(org, status);
  }

  async function runDecide(org: AdminOrganization, status: OrgApprovalStatus, reason?: string) {
    setBusyId(org.id);
    try {
      const supabase = createSupabaseBrowserClient();
      await setOrgApproval(supabase, org.id, status, reason);
      setToast({
        variant: "success",
        message: `«${org.name}» quedó como ${orgApprovalLabels[status].toLowerCase()}.`,
      });
      await load();
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible actualizar la organización.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject(reason: string) {
    const org = pendingReject;
    if (!org) return;
    setPendingReject(null);
    await runDecide(org, "rejected", reason || undefined);
  }

  async function saveQrPrefix(org: AdminOrganization) {
    const raw = (qrPrefixInputs[org.id] ?? org.qrPrefix ?? "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(raw)) {
      setToast({ variant: "error", message: "El prefijo debe ser exactamente 3 letras (A-Z)." });
      return;
    }
    setSavingPrefixId(org.id);
    try {
      const supabase = createSupabaseBrowserClient();
      await setProviderQrPrefix(supabase, org.id, raw);
      setToast({ variant: "success", message: `Prefijo QR de «${org.name}» asignado: ${raw}.` });
      await load();
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible asignar el prefijo.",
      });
    } finally {
      setSavingPrefixId(null);
    }
  }

  async function toggleActive(org: AdminOrganization) {
    setBusyId(org.id);
    try {
      const supabase = createSupabaseBrowserClient();
      await setOrgActive(supabase, org.id, !org.isActive);
      setToast({
        variant: "success",
        message: org.isActive ? `«${org.name}» quedó inactiva.` : `«${org.name}» quedó activa.`,
      });
      await load();
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible actualizar la organización.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Organizaciones</h1>
        <p className={controls.pageSubtitle}>
          Veterinarias, fundaciones y aliados que solicitan aparecer en Huellas de Vuelta. Solo las
          aprobadas y activas se muestran en la página principal: veterinarias y fundaciones en su
          directorio y en el mapa; aliados en la sección de empresas que apoyan la causa.
        </p>
      </div>

      <div className={styles.tabs} role="tablist">
        {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={tab === key ? styles.tabActive : styles.tab}
            onClick={() => setTab(key)}
          >
            {TAB_LABEL[key]} ({counts[key]})
          </button>
        ))}
      </div>

      {state === "loading" && <TableSkeletonBody />}
      {state === "error" && <p className={controls.empty}>No fue posible cargar las organizaciones.</p>}

      {state === "ready" && visible.length === 0 && (
        <p className={styles.empty}>No hay organizaciones en esta categoría.</p>
      )}

      {state === "ready" && visible.length > 0 && (
        <ul className={styles.list}>
          {visible.map((org) => (
            <li key={org.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <span className={styles.category}>{orgCategoryLabels[org.category]}</span>
                  <p className={styles.name}>{org.name}</p>
                </div>
                <span className={styles.statusWrap}>
                  <span className={`${styles.status} ${styles[`status_${org.approvalStatus}`]}`}>
                    {orgApprovalLabels[org.approvalStatus]}
                  </span>
                  {!org.isActive && <span className={`${styles.status} ${styles.status_inactive}`}>Inactiva</span>}
                </span>
              </div>

              <dl className={styles.details}>
                <div><dt>Responsable</dt><dd>{org.ownerDisplayName ?? "—"} · {org.ownerEmail ?? "sin correo"}</dd></div>
                <div><dt>Ubicación</dt><dd>{[org.address, org.neighborhood, org.city].filter(Boolean).join(", ") || "No indicada"}</dd></div>
                <div>
                  <dt>Coordenadas</dt>
                  <dd>
                    {org.lat != null && org.lng != null ? (
                      <>
                        {org.lat.toFixed(5)}, {org.lng.toFixed(5)}{" "}
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${org.lat}&mlon=${org.lng}#map=16/${org.lat}/${org.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ver en el mapa
                        </a>
                      </>
                    ) : (
                      "Sin coordenadas · no aparecerá en el mapa del Landing"
                    )}
                  </dd>
                </div>
                <div><dt>Contacto</dt><dd>{[org.phone, org.whatsapp, org.email].filter(Boolean).join(" · ") || "No indicado"}</dd></div>
                <div><dt>Publicación</dt><dd>{org.status === "published" ? "Publicada por la organización" : "Borrador"}</dd></div>
                {org.description && <div><dt>Descripción</dt><dd>{org.description}</dd></div>}
                {org.rejectionReason && <div><dt>Motivo de rechazo</dt><dd>{org.rejectionReason}</dd></div>}
                {org.kind === "proveedor" && (
                  <div>
                    <dt>Prefijo QR</dt>
                    <dd>
                      {org.qrPrefix ?? "Sin asignar"} · usado en los códigos que este proveedor genera
                      (ej. {org.qrPrefix ?? "XXX"}-001)
                    </dd>
                  </div>
                )}
              </dl>

              {org.kind === "proveedor" && (
                <div className={styles.actions} style={{ alignItems: "center" }}>
                  <input
                    className={controls.input}
                    style={{ maxWidth: "8rem", textTransform: "uppercase" }}
                    placeholder="Ej. PRV"
                    maxLength={3}
                    value={qrPrefixInputs[org.id] ?? org.qrPrefix ?? ""}
                    onChange={(event) =>
                      setQrPrefixInputs((prev) => ({ ...prev, [org.id]: event.target.value.toUpperCase() }))
                    }
                  />
                  <button
                    type="button"
                    className={styles.reset}
                    disabled={savingPrefixId === org.id}
                    onClick={() => saveQrPrefix(org)}
                  >
                    {savingPrefixId === org.id
                      ? "Guardando…"
                      : org.qrPrefix
                        ? "Cambiar prefijo QR"
                        : "Asignar prefijo QR"}
                  </button>
                </div>
              )}

              <div className={styles.actions}>
                {org.approvalStatus !== "approved" && (
                  <button
                    type="button"
                    className={styles.approve}
                    disabled={busyId === org.id}
                    onClick={() => decide(org, "approved")}
                  >
                    Aprobar
                  </button>
                )}
                {org.approvalStatus !== "rejected" && (
                  <button
                    type="button"
                    className={styles.reject}
                    disabled={busyId === org.id}
                    onClick={() => decide(org, "rejected")}
                  >
                    Rechazar
                  </button>
                )}
                {org.approvalStatus !== "pending" && (
                  <button
                    type="button"
                    className={styles.reset}
                    disabled={busyId === org.id}
                    onClick={() => decide(org, "pending")}
                  >
                    Volver a pendiente
                  </button>
                )}
                <button
                  type="button"
                  className={styles.reset}
                  disabled={busyId === org.id}
                  onClick={() => toggleActive(org)}
                >
                  {org.isActive ? "Desactivar" : "Reactivar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PromptDialog
        open={pendingReject !== null}
        title="Rechazar organización"
        message={`El motivo lo verá «${pendingReject?.name ?? ""}» en su panel.`}
        label="Motivo del rechazo (opcional)"
        placeholder="Explica por qué no se aprueba, para que la organización pueda corregirlo."
        confirmLabel={busyId === pendingReject?.id ? "Guardando…" : "Rechazar"}
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={confirmReject}
        onCancel={() => setPendingReject(null)}
      />

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
