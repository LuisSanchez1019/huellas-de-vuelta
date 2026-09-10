"use client";

import { useCallback, useEffect, useState } from "react";
import { IdCardIcon } from "@/components/icons/Icon";
import OrgTypeChoice from "@/components/auth/OrgTypeChoice";
import hero from "./Hero.module.css";
import styles from "./orgAccessModal.module.css";

/**
 * Tarjeta "Ingreso vet / fun" del Hero. En vez de enlazar directo a un login,
 * abre una modal para elegir Veterinaria o Fundación (cada una lleva a su
 * propio login/registro). Es el único trozo cliente del Hero.
 */
export default function OrgAccessCard() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        className={`${hero.accessCard} ${hero.accessOrg}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className={hero.accessIcon} aria-hidden="true"><IdCardIcon size={22} /></span>
        <span className={hero.accessTitle}>Ingreso vet / fun</span>
        <span className={hero.accessText}>Gestiona tu organización y ayuda a las mascotas de tu comunidad.</span>
      </button>

      {open && (
        <div className={styles.overlay} onClick={close}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-access-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="org-access-title" className={styles.title}>¿Cómo deseas ingresar?</p>
            <OrgTypeChoice onNavigate={close} />
            <button type="button" className={styles.close} onClick={close}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}
