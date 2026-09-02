"use client";

import { useEffect, useRef, useState } from "react";
import { resizeImage } from "@/lib/images/resizeImage";
import styles from "./registerPet.module.css";

export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

export interface PreparedPhoto {
  blob: Blob;
  contentType: string;
}

export default function PetPhotoInput({
  onChange,
  onError,
  disabled = false,
  initialPreviewUrl = null,
}: {
  onChange: (photo: PreparedPhoto | null) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
  /** URL de una foto ya guardada, para mostrarla como vista previa inicial. */
  initialPreviewUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialPreviewUrl);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function openPicker() {
    inputRef.current?.click();
  }

  function clearPhoto() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    onChange(null);
    onError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Se limpia el valor para permitir volver a elegir el mismo archivo.
    event.target.value = "";
    if (!file) return;

    onError(null);

    const isAllowedType = (ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type);
    if (!isAllowedType) {
      onError("Formato de imagen no permitido. Usa JPG, JPEG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      onError("La imagen supera el límite de 5 MB. Elige una más liviana.");
      return;
    }

    setIsProcessing(true);
    try {
      const resized = await resizeImage(file);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return resized.previewUrl;
      });
      onChange({ blob: resized.blob, contentType: resized.contentType });
    } catch (error) {
      onError(error instanceof Error ? error.message : "No fue posible procesar la imagen.");
      clearPhoto();
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className={styles.photoField}>
      <span className={styles.photoLabel}>Foto de la mascota</span>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={styles.photoInput}
        onChange={handleFileChange}
        disabled={disabled || isProcessing}
      />

      {preview ? (
        <div className={styles.photoPreviewWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (object URL), no un asset servido */}
          <img src={preview} alt="Vista previa de la foto de la mascota" className={styles.photoPreview} />
          <div className={styles.photoActions}>
            <button type="button" className={styles.photoActionButton} onClick={openPicker} disabled={disabled || isProcessing}>
              Cambiar foto
            </button>
            <button type="button" className={styles.photoActionButtonDanger} onClick={clearPhoto} disabled={disabled || isProcessing}>
              Eliminar foto
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
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m4 18 5-4 4 3 3-2 4 3" />
          </svg>
          <span className={styles.photoDropzoneTitle}>
            {isProcessing ? "Procesando imagen…" : "Subir foto"}
          </span>
          <span className={styles.photoHint}>
            En el celular puedes elegir de la galería o tomarla con la cámara. JPG, JPEG, PNG o WebP · máx. 5 MB.
          </span>
        </button>
      )}
    </div>
  );
}
