"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./feedback.module.css";

/**
 * Ventana emergente para pedir un texto corto (p. ej. un motivo), con estilo
 * propio de la página — reemplaza a `window.prompt` del navegador. Se cierra
 * con Escape, con el botón Cancelar o pulsando fuera de la tarjeta.
 */
export default function PromptDialog({
  open,
  title,
  message,
  label,
  placeholder,
  required = false,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  // Vacía el campo cada vez que el diálogo pasa de cerrado a abierto (ajuste
  // de estado durante el render, no dentro de un efecto).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue("");
  }

  useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancelRef.current();
    }
    document.addEventListener("keydown", handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  function submit() {
    const trimmed = value.trim();
    if (required && !trimmed) return;
    onConfirm(trimmed);
  }

  const blocked = required && !value.trim();

  return (
    <div className={styles.dialogScrim} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="prompt-dialog-title" className={styles.dialogTitle}>{title}</h2>
        {message && <p className={styles.dialogMessage}>{message}</p>}
        <label className={styles.dialogField}>
          {label}
          <textarea
            ref={textareaRef}
            className={styles.dialogTextarea}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        </label>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogCancel} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? styles.dialogConfirmDanger : styles.dialogConfirm}
            onClick={submit}
            disabled={blocked}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
