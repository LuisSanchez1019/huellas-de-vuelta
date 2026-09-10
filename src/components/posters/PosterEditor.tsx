"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  deletePosterImage,
  isSafePosterUrl,
  posterErrorMessage,
  submitPoster,
  uploadPosterImage,
  upsertPoster,
  type MyPoster,
} from "@/lib/supabase/posters";
import {
  POSTER_ALLOWED_TYPES,
  POSTER_RECOMMENDED_LABEL,
  preparePoster,
  type PreparedPoster,
} from "@/lib/images/preparePoster";
import controls from "@/components/ui/controls.module.css";
import styles from "./postersPanel.module.css";

interface Props {
  ownerId: string;
  orgName: string;
  editing: MyPoster | null;
  existingImageUrl: string | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

export default function PosterEditor({ ownerId, orgName, editing, existingImageUrl, onCancel, onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [targetUrl, setTargetUrl] = useState(editing?.targetUrl ?? "");
  const [prepared, setPrepared] = useState<PreparedPoster | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (prepared) URL.revokeObjectURL(prepared.previewUrl);
    };
  }, [prepared]);

  const previewUrl = prepared?.previewUrl ?? existingImageUrl;
  const hasImage = Boolean(prepared || editing?.imagePath);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (!(POSTER_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      setError("El formato del poster no es válido. Usa JPG, PNG o WebP.");
      return;
    }
    setProcessing(true);
    try {
      const next = await preparePoster(file);
      if (prepared) URL.revokeObjectURL(prepared.previewUrl);
      setPrepared(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible procesar la imagen.");
    } finally {
      setProcessing(false);
    }
  }

  async function save(submitAfter: boolean) {
    setError(null);
    if (!hasImage) {
      setError("Sube la imagen del poster.");
      return;
    }
    if (targetUrl.trim() && !isSafePosterUrl(targetUrl)) {
      setError("El enlace debe empezar por https:// o http:// y no tener espacios.");
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    let uploadedPath: string | null = null;
    try {
      let imagePath = editing?.imagePath ?? "";
      if (prepared) {
        uploadedPath = await uploadPosterImage(supabase, ownerId, prepared.blob, prepared.contentType);
        imagePath = uploadedPath;
      }

      const id = await upsertPoster(supabase, {
        id: editing?.id ?? null,
        imagePath,
        title: title.trim() || null,
        description: description.trim() || null,
        targetUrl: targetUrl.trim() || null,
      });

      // Se guardó bien: si se reemplazó la imagen, borra la anterior.
      if (prepared && editing?.imagePath && editing.imagePath !== imagePath) {
        await deletePosterImage(supabase, editing.imagePath);
      }

      if (submitAfter) {
        await submitPoster(supabase, id);
        onSaved("Poster enviado a revisión. Te avisaremos cuando el administrador lo revise.");
      } else {
        onSaved("Borrador guardado.");
      }
    } catch (err) {
      // Si la subida quedó huérfana (falló el upsert), límpiala.
      if (uploadedPath) await deletePosterImage(supabase, uploadedPath);
      setError(posterErrorMessage(err));
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form className={styles.editor} onSubmit={handleSubmit}>
      <section className={controls.section}>
        <p className={controls.sectionTitle}>{editing ? "Editar poster" : "Nuevo poster"}</p>
        <div className={controls.sectionBody}>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={styles.fileInput}
              onChange={handleFile}
              disabled={busy || processing}
            />
            {previewUrl ? (
              <div className={styles.previewWrap}>
                <span className={styles.previewLabel}>Vista previa (así se verá en la Landing)</span>
                <div className={styles.previewCard}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local / imagen firmada */}
                  <img src={previewUrl} alt="Vista previa del poster" className={styles.previewImg} />
                  {title.trim() && (
                    <div className={styles.previewCaption}>
                      <span className={styles.previewCaptionTitle}>{title.trim()}</span>
                      <span className={styles.previewCaptionOrg}>{orgName}</span>
                    </div>
                  )}
                </div>
                <div className={styles.previewActions}>
                  <button
                    type="button"
                    className={controls.buttonSecondary}
                    onClick={() => inputRef.current?.click()}
                    disabled={busy || processing}
                  >
                    {processing ? "Procesando…" : "Cambiar imagen"}
                  </button>
                </div>
                {prepared?.wasCropped && (
                  <p className={styles.muted}>
                    La imagen se ajustó al formato banner 3:1 (recorte centrado, sin deformar). Revisa la
                    vista previa.
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                className={styles.dropzone}
                onClick={() => inputRef.current?.click()}
                disabled={busy || processing}
              >
                <span className={styles.dropzoneTitle}>{processing ? "Procesando…" : "Subir imagen del poster"}</span>
                <span className={styles.dropzoneHint}>
                  Formato recomendado: {POSTER_RECOMMENDED_LABEL} (proporción 3:1). JPG, PNG o WebP · máx. 3 MB.
                </span>
              </button>
            )}
          </div>

          <label className={controls.field}>
            Título (opcional)
            <input
              className={controls.input}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              placeholder="La propia imagen puede contener la información principal"
            />
          </label>
          <label className={controls.field}>
            Descripción (opcional)
            <textarea
              className={controls.textarea}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={300}
              rows={3}
            />
          </label>
          <label className={controls.field}>
            Enlace (opcional)
            <input
              className={controls.input}
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              maxLength={500}
              placeholder="https://…"
              inputMode="url"
            />
            <span className="hint">Solo enlaces https:// o http://. Se abren en una pestaña nueva.</span>
          </label>

          <p className={controls.notice}>
            Los posters deben estar relacionados con los servicios, actividades o trabajo de tu
            organización y cumplir las normas de Huellas de Vuelta. Un administrador revisa cada poster
            antes de publicarlo; si se aprueba, aparece en la Landing durante 24 horas.
          </p>

          {error && <p className={controls.errorText}>{error}</p>}

          <div className={controls.buttonRow}>
            <button type="button" className={controls.button} onClick={() => save(true)} disabled={busy || processing}>
              {busy ? "Guardando…" : "Guardar y enviar a revisión"}
            </button>
            <button type="button" className={controls.buttonSecondary} onClick={() => save(false)} disabled={busy || processing}>
              Guardar borrador
            </button>
            <button type="button" className={controls.buttonSecondary} onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
