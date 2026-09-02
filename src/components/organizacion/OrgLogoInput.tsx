"use client";

import { useEffect, useRef, useState } from "react";
import { prepareLogo, ALLOWED_LOGO_TYPES } from "@/lib/images/prepareLogo";
import { CameraIcon } from "@/components/icons/Icon";
import styles from "@/components/mascotas/registerPet.module.css";

export interface PreparedOrgLogo {
  blob: Blob;
  contentType: string;
}

/**
 * Carga del logo de la organización. Misma UX que `PetPhotoInput`:
 * vista previa, cambiar, eliminar, validar formato/tamaño y optimizar.
 * SVG se conserva vectorial (saneado); el resto se guarda raster de alta calidad.
 */
export default function OrgLogoInput({
  initialPreviewUrl = null,
  onChange,
  onError,
  disabled = false,
}: {
  initialPreviewUrl?: string | null;
  onChange: (logo: PreparedOrgLogo | null, removed: boolean) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialPreviewUrl);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  function openPicker() {
    inputRef.current?.click();
  }

  function clearLogo() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
    setPreview(null);
    onChange(null, true);
    onError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    onError(null);

    if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
      onError("Formato no permitido. Usa PNG, JPG, WebP o SVG.");
      return;
    }

    setIsProcessing(true);
    try {
      const prepared = await prepareLogo(file);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl(prepared.previewUrl);
      setPreview(prepared.previewUrl);
      onChange({ blob: prepared.blob, contentType: prepared.contentType }, false);
    } catch (error) {
      onError(error instanceof Error ? error.message : "No fue posible procesar el logo.");
      clearLogo();
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className={styles.photoField}>
      <span className={styles.photoLabel}>Logo de la organización</span>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className={styles.photoInput}
        onChange={handleFileChange}
        disabled={disabled || isProcessing}
      />

      {preview ? (
        <div className={styles.photoPreviewWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local / logo público */}
          <img src={preview} alt="Vista previa del logo" className={styles.photoPreview} />
          <div className={styles.photoActions}>
            <button type="button" className={styles.photoActionButton} onClick={openPicker} disabled={disabled || isProcessing}>
              Cambiar logo
            </button>
            <button type="button" className={styles.photoActionButtonDanger} onClick={clearLogo} disabled={disabled || isProcessing}>
              Eliminar logo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.photoDropzone}
          onClick={openPicker}
          disabled={disabled || isProcessing}
        >
          <CameraIcon size={30} />
          <span className={styles.photoDropzoneTitle}>
            {isProcessing ? "Procesando…" : "Subir logo"}
          </span>
          <span className={styles.photoHint}>
            PNG, JPG, WebP o SVG · máx. 2 MB. El SVG se conserva vectorial; las imágenes se optimizan.
          </span>
        </button>
      )}
    </div>
  );
}
