"use client";

import { useEffect, useRef } from "react";
import styles from "./feedback.module.css";

export type ToastVariant = "success" | "error";

export interface ToastState {
  variant: ToastVariant;
  message: string;
}

/**
 * Aviso flotante anclado a la parte inferior de la pantalla. Se cierra solo tras
 * `duration` ms y también con el botón de cerrar. Un único toast a la vez: el
 * componente padre guarda el estado y lo renderiza cuando hay algo que mostrar.
 */
export default function Toast({
  variant,
  message,
  onClose,
  duration,
}: {
  variant: ToastVariant;
  message: string;
  onClose: () => void;
  duration?: number;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const ms = duration ?? (variant === "error" ? 6000 : 4000);
  useEffect(() => {
    const id = window.setTimeout(() => onCloseRef.current(), ms);
    return () => window.clearTimeout(id);
  }, [message, variant, ms]);

  return (
    <div className={styles.toastViewport}>
      <div
        className={`${styles.toast} ${variant === "error" ? styles.toastError : styles.toastSuccess}`}
        role={variant === "error" ? "alert" : "status"}
        aria-live={variant === "error" ? "assertive" : "polite"}
      >
        <span className={styles.toastIcon} aria-hidden="true">{variant === "error" ? "!" : "✓"}</span>
        <p className={styles.toastMessage}>{message}</p>
        <button type="button" className={styles.toastClose} onClick={onClose} aria-label="Cerrar aviso">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
