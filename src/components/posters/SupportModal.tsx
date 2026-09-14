"use client";

import { useEffect, useRef, useState } from "react";
import { POSTER_SUPPORT } from "@/lib/posters/support";
import { CloseIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "./postersPanel.module.css";

/**
 * Aviso de APOYO VOLUNTARIO. Se muestra cada vez que la organización entra a
 * Posters (§ ver `PostersPanel`). Se puede cerrar con la X, con "Entendido" o
 * con Escape, y se cierra solo a los `POSTER_SUPPORT.autoCloseSeconds`
 * segundos si nadie interactúa. Nada de la creación, revisión, aprobación o
 * publicación de posters depende de este aviso ni de haber aportado.
 */
export default function SupportModal({ onClose }: { onClose: () => void }) {
  const [thanks, setThanks] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  // Se cierra solo si nadie interactúa, una sola vez al montar.
  useEffect(() => {
    const timer = window.setTimeout(() => onCloseRef.current(), POSTER_SUPPORT.autoCloseSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, []);

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
