"use client";

import { useEffect, useState } from "react";
import { POSTER_SUPPORT } from "@/lib/posters/support";
import { CloseIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "./postersPanel.module.css";

/**
 * Mensaje de APOYO VOLUNTARIO que se muestra una vez antes de crear el primer
 * poster (§26). "Continuar sin donar" siempre funciona: nada de la creación,
 * revisión, aprobación o publicación depende de haber donado, y no se registra
 * quién donó. La llave real todavía no existe: se muestra un marcador.
 */
export default function SupportModal({ onClose }: { onClose: () => void }) {
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="poster-support-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="poster-support-title" className={styles.modalTitle}>{POSTER_SUPPORT.title}</p>
        {POSTER_SUPPORT.paragraphs.map((paragraph) => (
          <p key={paragraph} className={styles.modalText}>{paragraph}</p>
        ))}

        <div className={styles.keyBox}>
          <p className={styles.keyLabel}>{POSTER_SUPPORT.keyLabel}</p>
          <p className={styles.keyValue}>{POSTER_SUPPORT.keyValue ?? POSTER_SUPPORT.keyPlaceholder}</p>
        </div>

        {thanks && <p className={styles.modalText}>{POSTER_SUPPORT.thanksNote}</p>}

        <div className={styles.modalActions}>
          {thanks ? (
            <button type="button" className={controls.button} onClick={onClose}>Continuar</button>
          ) : (
            <>
              <button type="button" className={controls.buttonSecondary} onClick={() => setThanks(true)}>
                {POSTER_SUPPORT.supportCta}
              </button>
              <button type="button" className={controls.button} onClick={onClose}>
                {POSTER_SUPPORT.continueCta}
              </button>
            </>
          )}
          <button
            type="button"
            className={controls.chipRemove}
            aria-label="Cerrar"
            onClick={onClose}
            style={{ marginLeft: "auto" }}
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
