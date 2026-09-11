"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DATA_POLICY_PATH, DATA_POLICY_VERSION } from "@/lib/legal/policy";
import {
  fetchPendingPolicyConsent,
  recordPolicyConsent,
} from "@/lib/supabase/policyConsent";
import styles from "./PolicyConsentGate.module.css";

/**
 * Aviso de re-consentimiento para cuentas existentes.
 *
 * Estrategia segura (§13): NO se marca automáticamente a nadie como si hubiera
 * aceptado la política. Cuando el servidor informa (`my_pending_policy_consent`)
 * que la cuenta autenticada no tiene registro de la versión vigente, se muestra
 * un aviso no descartable que permite: (a) leer la política completa y aceptarla
 * de forma expresa, o (b) cerrar sesión. Nunca bloquea de forma arbitraria: el
 * usuario siempre puede continuar aceptando o salir.
 *
 * En modo desarrollo sin sesión real no hace nada.
 */
export default function PolicyConsentGate({ onSignOut }: { onSignOut: () => void }) {
  const [pending, setPending] = useState<{ policyType: string; policyVersion: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (active) setChecked(true);
        return;
      }
      try {
        const result = await fetchPendingPolicyConsent(supabase);
        if (active) {
          setPending(result);
          setChecked(true);
        }
      } catch {
        // Si la comprobación falla, no se bloquea el panel.
        if (active) setChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!checked || !pending) return null;

  async function accept() {
    if (!accepted) {
      setError("Marca la casilla para confirmar que aceptas la política.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordPolicyConsent(createSupabaseBrowserClient());
      setPending(null);
    } catch {
      setError("No fue posible registrar la aceptación. Intenta de nuevo.");
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="policy-consent-title">
      <div className={styles.modal}>
        <p className={styles.eyebrow}>Protección de datos personales</p>
        <h2 id="policy-consent-title" className={styles.title}>
          Actualizamos la Política de Tratamiento de Datos Personales
        </h2>
        <p className={styles.text}>
          Para seguir usando tu cuenta necesitamos tu aceptación de la versión vigente
          (versión {DATA_POLICY_VERSION}). Puedes leer el documento completo antes de aceptar.
        </p>

        <label className={styles.consentRow}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked);
              setError(null);
            }}
          />
          <span>
            He leído y acepto la{" "}
            <Link
              className={styles.link}
              href={DATA_POLICY_PATH}
              target="_blank"
              rel="noopener noreferrer"
            >
              Política de Tratamiento de Datos Personales
            </Link>{" "}
            de Huellas de Vuelta y autorizo el tratamiento de mis datos personales de acuerdo con las
            finalidades informadas.
          </span>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={accept} disabled={saving}>
            {saving ? "Guardando…" : "Aceptar y continuar"}
          </button>
          <button type="button" className={styles.secondary} onClick={onSignOut} disabled={saving}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
