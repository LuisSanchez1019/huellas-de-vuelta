"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchOrgProfileRow, type OrgProfileKind, type OrgProfileRow } from "@/lib/supabase/orgProfiles";
import {
  deletePoster,
  deletePosterImage,
  displayPosterStatus,
  fetchMyPosterQuota,
  fetchMyPosters,
  getPosterSignedUrls,
  posterErrorMessage,
  submitPoster,
  type MyPoster,
  type PosterQuota,
  type PosterStatus,
} from "@/lib/supabase/posters";
import { PUBLIC_POSTERS_TAG, triggerPublicRevalidate } from "@/lib/cache/tags";
import { POSTER_SUPPORT_SEEN_KEY } from "@/lib/posters/support";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import PosterEditor from "./PosterEditor";
import SupportModal from "./SupportModal";
import styles from "./postersPanel.module.css";

const KIND_LABEL: Record<OrgProfileKind, string> = { veterinaria: "veterinaria", fundacion: "fundación" };
const PROFILE_HREF: Record<OrgProfileKind, string> = {
  veterinaria: "/veterinaria/perfil/crear",
  fundacion: "/fundacion/perfil",
};

const STATUS_LABEL: Record<PosterStatus, string> = {
  draft: "Borrador",
  pending: "En revisión",
  approved: "Vigente en la Landing",
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

function timeLeft(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "vencido";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours >= 1 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export default function PostersPanel({ kind }: { kind: OrgProfileKind }) {
  const [phase, setPhase] = useState<"loading" | "ready" | "no-session" | "no-org" | "error">("loading");
  const [ownerId, setOwnerId] = useState<string>("");
  const [org, setOrg] = useState<OrgProfileRow | null>(null);
  const [quota, setQuota] = useState<PosterQuota | null>(null);
  const [posters, setPosters] = useState<MyPoster[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPoster, setEditingPoster] = useState<MyPoster | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      const check = await resolvePanelSession();
      if (check.status === "unauthenticated") {
        setPhase("no-session");
        return;
      }
      const uid = check.session.userId;
      setOwnerId(uid);
      // Bypass de solo-desarrollo: el id simulado no es un UUID real, así que no
      // hay organización que consultar. Se muestra el estado "sin perfil".
      if (check.status === "dev") {
        setPhase("no-org");
        return;
      }
      try {
        const row = await fetchOrgProfileRow(kind, uid);
        if (!row) {
          setPhase("no-org");
          return;
        }
        setOrg(row);
        const supabase = createSupabaseBrowserClient();
        const [nextQuota, nextPosters] = await Promise.all([
          fetchMyPosterQuota(supabase),
          fetchMyPosters(supabase),
        ]);
        setQuota(nextQuota);
        setPosters(nextPosters);
        setUrls(await getPosterSignedUrls(supabase, nextPosters.map((poster) => poster.imagePath)));
        setPhase("ready");
      } catch {
        setPhase("error");
      }
    });
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  function openEditor(poster: MyPoster | null) {
    setEditingPoster(poster);
    if (poster === null) {
      let seen = false;
      try {
        seen = window.localStorage.getItem(POSTER_SUPPORT_SEEN_KEY) === "1";
      } catch {
        /* almacenamiento no disponible */
      }
      if (!seen) {
        setShowSupport(true);
        return;
      }
    }
    setEditorOpen(true);
  }

  function closeSupport() {
    try {
      window.localStorage.setItem(POSTER_SUPPORT_SEEN_KEY, "1");
    } catch {
      /* almacenamiento no disponible */
    }
    setShowSupport(false);
    setEditorOpen(true);
  }

  function handleSaved(message: string) {
    setEditorOpen(false);
    setEditingPoster(null);
    setToast({ variant: "success", message });
    triggerPublicRevalidate([PUBLIC_POSTERS_TAG]);
    void load();
  }

  async function quickSubmit(poster: MyPoster) {
    setBusyId(poster.id);
    try {
      await submitPoster(createSupabaseBrowserClient(), poster.id);
      setToast({ variant: "success", message: "Poster enviado a revisión." });
      await load();
    } catch (error) {
      setToast({ variant: "error", message: posterErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(poster: MyPoster) {
    if (!window.confirm("¿Eliminar este poster? Esta acción no se puede deshacer.")) return;
    setBusyId(poster.id);
    try {
      const supabase = createSupabaseBrowserClient();
      await deletePoster(supabase, poster.id);
      await deletePosterImage(supabase, poster.imagePath);
      setToast({ variant: "success", message: "Poster eliminado." });
      if (poster.isLive) triggerPublicRevalidate([PUBLIC_POSTERS_TAG]);
      await load();
    } catch (error) {
      setToast({ variant: "error", message: posterErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  if (phase === "loading") return <p className={controls.loading}>Cargando…</p>;
  if (phase === "no-session") {
    return <p className={controls.empty}>Inicia sesión con tu cuenta de organización para gestionar los posters.</p>;
  }
  if (phase === "error") {
    return <p className={controls.empty}>No fue posible cargar los posters. Vuelve a intentarlo.</p>;
  }
  if (phase === "no-org") {
    return (
      <div>
        <div className={controls.pageHead}>
          <h1 className={controls.pageTitle}>Posters</h1>
        </div>
        <p className={controls.empty}>
          Primero crea el perfil de tu {KIND_LABEL[kind]}.{" "}
          <Link href={PROFILE_HREF[kind]}>Crear perfil</Link>.
        </p>
      </div>
    );
  }

  const orgReady = org?.status === "published" && org.approval_status === "approved" && org.is_active;
  const orgName = org?.name ?? "";
  const existingUrl = editingPoster ? urls.get(editingPoster.imagePath) ?? null : null;

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Posters</h1>
        <p className={controls.pageSubtitle}>
          Envía un poster horizontal para que aparezca temporalmente en la Landing de Huellas de Vuelta.
          Un administrador lo revisa; si se aprueba, se muestra durante 24 horas y luego pasa a tu
          historial. Publicar es voluntario y sin costo.
        </p>
      </div>

      {!orgReady && (
        <p className={controls.notice}>
          Tu organización todavía no está aprobada y activa. Puedes preparar borradores, pero los
          posters solo se publican cuando el equipo de Huellas de Vuelta aprueba la organización.
        </p>
      )}

      {quota && (
        <p className={styles.quota}>
          <span>
            Publicaciones aprobadas esta semana:{" "}
            <span className={styles.quotaStrong}>
              {quota.approvedLast7d} / {quota.weeklyLimit}
            </span>{" "}
            (ventana móvil de 7 días)
          </span>
          {quota.hasLive && <span>· Tienes 1 poster vigente en la Landing</span>}
          {quota.hasPending && <span>· Tienes un poster en revisión</span>}
        </p>
      )}

      {!editorOpen && (
        <div className={styles.toolbar}>
          <button type="button" className={controls.button} onClick={() => openEditor(null)}>
            Crear poster
          </button>
        </div>
      )}

      {editorOpen && (
        <PosterEditor
          ownerId={ownerId}
          orgName={orgName}
          editing={editingPoster}
          existingImageUrl={existingUrl}
          onCancel={() => {
            setEditorOpen(false);
            setEditingPoster(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {posters.length === 0 && !editorOpen ? (
        <p className={controls.empty}>Todavía no has creado ningún poster.</p>
      ) : (
        <div className={styles.list}>
          {posters.map((poster) => {
            const shown = displayPosterStatus(poster.status, poster.expiresAt);
            const url = urls.get(poster.imagePath) ?? null;
            const editable = shown === "draft" || shown === "rejected";
            return (
              <article key={poster.id} className={styles.card}>
                <div className={styles.thumb}>
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- imagen firmada de Storage
                    <img src={url} alt={poster.title ?? "Poster"} className={styles.thumbImg} />
                  ) : (
                    <span className={styles.thumbEmpty}>Sin vista previa</span>
                  )}
                </div>
                <div className={styles.body}>
                  <div className={styles.rowTop}>
                    <span className={`${styles.pill} ${styles[`pill_${shown}`]}`}>{STATUS_LABEL[shown]}</span>
                    {poster.title && <span className={styles.posterTitle}>{poster.title}</span>}
                  </div>

                  {shown === "approved" && poster.isLive && (
                    <p className={styles.muted}>
                      Vence en {timeLeft(poster.expiresAt)} · {formatDate(poster.expiresAt)}
                    </p>
                  )}
                  {shown === "pending" && (
                    <p className={styles.muted}>Enviado el {formatDate(poster.submittedAt)}. En espera de revisión.</p>
                  )}
                  {shown === "rejected" && (
                    <p className={styles.muted}>
                      Rechazado{poster.rejectionReason ? `: ${poster.rejectionReason}` : "."} Puedes corregirlo y
                      volver a enviarlo.
                    </p>
                  )}
                  {shown === "expired" && (
                    <p className={styles.muted}>Estuvo publicado y ya venció ({formatDate(poster.expiresAt)}).</p>
                  )}
                  {shown === "inactive" && (
                    <p className={styles.muted}>Un administrador desactivó este poster.</p>
                  )}
                  {shown === "draft" && (
                    <p className={styles.muted}>Borrador creado el {formatDate(poster.createdAt)}. Aún no enviado.</p>
                  )}

                  {poster.description && <p className={styles.muted}>{poster.description}</p>}
                  {poster.targetUrl && (
                    <p className={styles.muted}>
                      Enlace: <span className={styles.link}>{poster.targetUrl}</span>
                    </p>
                  )}

                  <div className={styles.actions}>
                    {editable && (
                      <>
                        <button
                          type="button"
                          className={controls.buttonSecondary}
                          disabled={busyId === poster.id}
                          onClick={() => openEditor(poster)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={controls.button}
                          disabled={busyId === poster.id}
                          onClick={() => quickSubmit(poster)}
                        >
                          Enviar a revisión
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className={controls.buttonDanger}
                      disabled={busyId === poster.id}
                      onClick={() => remove(poster)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showSupport && <SupportModal onClose={closeSupport} />}
      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
