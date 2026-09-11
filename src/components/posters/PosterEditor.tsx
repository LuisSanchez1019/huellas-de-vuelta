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
  POSTER_RECOMMENDED_LABEL,
  loadPosterSource,
  type PosterSource,
  type PreparedPoster,
} from "@/lib/images/preparePoster";
import PosterCropper from "./PosterCropper";
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
  const [source, setSource] = useState<PosterSource | null>(null);
  const [prepared, setPrepared] = useState<PreparedPoster | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Limpiar URLs de objeto SOLO al desmontar (las transiciones ya revocan a mano).
  const preparedRef = useRef<PreparedPoster | null>(null);
  const sourceRef = useRef<PosterSource | null>(null);
  useEffect(() => {
    preparedRef.current = prepared;
  }, [prepared]);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(
    () => () => {
      if (preparedRef.current) URL.revokeObjectURL(preparedRef.current.previewUrl);
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.objectUrl);
    },
    [],
  );

  const previewUrl = prepared?.previewUrl ?? existingImageUrl;
  const hasImage = Boolean(prepared || editing?.imagePath);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      const next = await loadPosterSource(file);
      if (source) URL.revokeObjectURL(source.objectUrl);
      setSource(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar la imagen.");
    } finally {
      setProcessing(false);
    }
  }

  function handleCropApplied(result: PreparedPoster) {
    if (prepared) URL.revokeObjectURL(prepared.previewUrl);
    if (source) URL.revokeObjectURL(source.objectUrl);
    setSource(null);
    setPrepared(result);
  }

  function discardSource() {
    if (source) URL.revokeObjectURL(source.objectUrl);
    setSource(null);
  }

  async function save(submitAfter: boolean) {
    setError(null);
    if (!hasImage) {
      setError("Sube la imagen del poster y aplica el recorte.");
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
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={styles.fileInput}
            onChange={handleFile}
            disabled={busy || processing}
          />

          {source ? (
            <PosterCropper
              source={source}
              orgName={orgName}
              title={title}
              disabled={busy}
              onApply={handleCropApplied}
              onPickAnother={() => {
                discardSource();
                inputRef.current?.click();
              }}
              onCancel={discardSource}
            />
          ) : previewUrl ? (
            <div className={styles.previewWrap}>
              <span className={styles.previewLabel}>
                Vista previa · así aparecerá en la Landing ({POSTER_RECOMMENDED_LABEL}, 3:1)
              </span>
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
                  {processing ? "Cargando…" : "Cambiar imagen"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.dropzone}
              onClick={() => inputRef.current?.click()}
              disabled={busy || processing}
            >
              <span className={styles.dropzoneTitle}>
                {processing ? "Cargando…" : "Subir imagen del poster"}
              </span>
              <span className={styles.dropzoneHint}>
                Formato final: {POSTER_RECOMMENDED_LABEL} (proporción 3:1). JPG, PNG o WebP · máx. 3 MB ·
                mínimo equivalente a {POSTER_RECOMMENDED_LABEL}.
              </span>
            </button>
          )}

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
            <button
              type="button"
              className={controls.button}
              onClick={() => save(true)}
              disabled={busy || processing || Boolean(source)}
            >
              {busy ? "Guardando…" : "Guardar y enviar a revisión"}
            </button>
            <button
              type="button"
              className={controls.buttonSecondary}
              onClick={() => save(false)}
              disabled={busy || processing || Boolean(source)}
            >
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
