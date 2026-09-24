"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HeartIcon } from "@/components/icons/Icon";
import Modal from "@/components/ui/Modal";
import controls from "@/components/ui/controls.module.css";
import { birthdayCopy, type BirthdayPet } from "@/lib/pets/age";
import { claimBirthdayGreeting } from "@/lib/supabase/petBirthday";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./birthday.module.css";

/**
 * Ventana de cumpleaños. Se monta UNA vez en el layout del panel (no se vuelve a
 * ejecutar al navegar entre páginas) y consulta al servidor, que decide y registra
 * que hoy ya se mostró: una sola ventana por día y por usuario aunque haya varias
 * mascotas, varias pestañas o varios dispositivos. Si nadie cumple años, no muestra nada.
 * No usa localStorage ni sessionStorage.
 */
export default function BirthdayGreeting() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [pets, setPets] = useState<BirthdayPet[]>([]);
  const [open, setOpen] = useState(false);
  // Una sola consulta por montaje (React StrictMode repite los efectos en desarrollo).
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    claimBirthdayGreeting(supabase)
      .then((list) => {
        if (list.length > 0) {
          setPets(list);
          setOpen(true);
        }
      })
      .catch(() => {
        /* sin sesión real o error de red: simplemente no hay aviso */
      });
  }, [supabase]);

  if (!open || pets.length === 0) return null;
  const copy = birthdayCopy(pets);

  return (
    <Modal open title={copy.title} onClose={() => setOpen(false)}>
      <div className={styles.body}>
        <span className={styles.badge} aria-hidden="true">
          <HeartIcon size={30} />
        </span>
        <p className={styles.headline}>{copy.headline}</p>
        <p className={styles.thanks}>{copy.thanks}</p>
        <p className={styles.closing}>{copy.closing}</p>
        <div className={controls.buttonRow} style={{ justifyContent: "center" }}>
          <button type="button" className={controls.button} onClick={() => setOpen(false)}>
            Continuar
          </button>
        </div>
      </div>
    </Modal>
  );
}
