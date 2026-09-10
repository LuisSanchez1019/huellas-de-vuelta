"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  adminListPosters,
  adminReviewPoster,
  getPosterSignedUrls,
  posterErrorMessage,
  type AdminPoster,
  type PosterStatus,
} from "@/lib/supabase/posters";
import { PUBLIC_POSTERS_TAG, triggerPublicRevalidate } from "@/lib/cache/tags";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "./posters.module.css";

type Tab = "pending" | "approved" | "rejected" | "expired" | "inactive";

const TAB_LABEL: Record<Tab, string> = {
  pending: "Pendientes",
  approved: "Vigentes",
  rejected: "Rechazados",
  expired: "Vencidos",
  inactive: "Desactivados",
};

const STATUS_LABEL: Record<PosterStatus, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  approved: "Vigente",
  rejected: "Rechazado",
  expired: "Vencido",
  inactive: "Desactivado",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tabOf(poster: AdminPoster): Tab {
  if (poster.status === "pending") return "pending";
  if (poster.status === "approved") return "approved";
  if (poster.status === "rejected") return "rejected";
  if (poster.status === "inactive") return "inactive";
  return "expired"; // expired + draft (los borradores no llegan aquí normalmente)
}

export default function AdminPostersPage() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [posters, setPosters] = useState<AdminPoster[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const rows = await adminListPosters(supabase);
        setPosters(rows);
        setUrls(await getPosterSignedUrls(supabase, rows.map((row) => row.imagePath)));
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const base: Record<Tab, number> = { pending: 0, approved: 0, rejected: 0, expired: 0, inactive: 0 };
    for (const poster of posters) base[tabOf(poster)] += 1;
    return base;
  }, [posters]);

  const visible = posters.filter((poster) => tabOf(poster) === tab);

  async function review(poster: AdminPoster, action: "approve" | "reject" | "deactivate") {
    let reason: string | undefined;
    if (action === "reject") {
      const input = window.prompt(
        `Motivo del rechazo del poster de «${poster.orgName}» (lo verá la organización):`,
        "",
      );
      if (input === null) return;
      reason = input.trim() || undefined;
    }
    if (action === "deactivate" && !window.confirm("¿Desactivar este poster? Dejará de aparecer en la Landing.")) {
      return;
    }
    setBusyId(poster.id);
    try {
      await adminReviewPoster(createSupabaseBrowserClient(), poster.id, action, reason);
      setToast({
        variant: "success",
        message:
          action === "approve"
            ? "Poster aprobado. Ya aparece en la Landing durante 24 horas."
            : action === "reject"
              ? "Poster rechazado. Se notificó a la organización."
              : "Poster desactivado.",
      });
      triggerPublicRevalidate([PUBLIC_POSTERS_TAG]);
      await load();
    } catch (error) {
      setToast({ variant: "error", message: posterErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Posters</h1>
        <p className={controls.pageSubtitle}>
          Posters enviados por veterinarias y fundaciones para la Landing. Al aprobar, el poster aparece
          durante 24 horas y luego vence solo. Máximo 1 poster vigente por organización y 2 aprobados por
          organización cada 7 días.
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

      {state === "loading" && <p className={controls.loading}>Cargando…</p>}
      {state === "error" && <p className={styles.empty}>No fue posible cargar los posters.</p>}

      {state === "ready" && visible.length === 0 && (
        <p className={styles.empty}>No hay posters en esta categoría.</p>
      )}

      {state === "ready" && visible.length > 0 && (
        <ul className={styles.list}>
          {visible.map((poster) => {
            const url = urls.get(poster.imagePath) ?? null;
            return (
              <li key={poster.id} className={styles.card}>
                <div className={styles.thumb}>
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- imagen firmada de Storage (solo admin)
                    <img src={url} alt={`Poster de ${poster.orgName}`} className={styles.thumbImg} />
                  ) : (
                    <span className={styles.thumbEmpty}>Sin vista previa</span>
                  )}
                </div>

                <div className={styles.body}>
                  <div className={styles.head}>
                    <span className={styles.org}>{poster.orgName}</span>
                    <span className={styles.kind}>{poster.orgKind === "veterinaria" ? "Veterinaria" : "Fundación"}</span>
                    <span className={`${styles.status} ${styles[`status_${poster.status}`]}`}>
                      {STATUS_LABEL[poster.status]}
                    </span>
                  </div>

                  <dl className={styles.meta}>
                    <div><dt>Responsable</dt><dd>{poster.ownerEmail ?? "—"}</dd></div>
                    <div><dt>Enviado</dt><dd>{formatDate(poster.submittedAt)}</dd></div>
                    {poster.approvedAt && <div><dt>Aprobado</dt><dd>{formatDate(poster.approvedAt)}</dd></div>}
                    {poster.expiresAt && <div><dt>Expira</dt><dd>{formatDate(poster.expiresAt)}</dd></div>}
                    {poster.title && <div><dt>Título</dt><dd>{poster.title}</dd></div>}
                    {poster.description && <div><dt>Descripción</dt><dd>{poster.description}</dd></div>}
                    {poster.targetUrl && (
                      <div>
                        <dt>Enlace</dt>
                        <dd>
                          <a className={styles.link} href={poster.targetUrl} target="_blank" rel="noopener noreferrer nofollow">
                            {poster.targetUrl}
                          </a>
                        </dd>
                      </div>
                    )}
                    {poster.rejectionReason && <div><dt>Motivo rechazo</dt><dd>{poster.rejectionReason}</dd></div>}
                  </dl>

                  <div className={styles.actions}>
                    {poster.status === "pending" && (
                      <>
                        <button
                          type="button"
                          className={styles.approve}
                          disabled={busyId === poster.id}
                          onClick={() => review(poster, "approve")}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className={styles.reject}
                          disabled={busyId === poster.id}
                          onClick={() => review(poster, "reject")}
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {poster.status === "approved" && poster.isLive && (
                      <button
                        type="button"
                        className={styles.reject}
                        disabled={busyId === poster.id}
                        onClick={() => review(poster, "deactivate")}
                      >
                        Desactivar
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
