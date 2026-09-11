"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  accountDeletionPrecheck,
  fetchMyPrivacyPreferences,
  requestAccountDeletion,
  saveMyPrivacyPreferences,
  type DeletionBlocker,
  type PrivacyPreferences,
} from "@/lib/supabase/privacy";
import { fetchMyPolicyConsents, type PolicyConsent } from "@/lib/supabase/policyConsent";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "./settings.module.css";

const CONSENT_LABELS: Record<string, string> = {
  data_processing: "Política de Tratamiento de Datos Personales",
};

function formatConsentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

const PREFERENCES: {
  key: keyof Omit<PrivacyPreferences, "updatedAt">;
  title: string;
  purpose: string;
}[] = [
  {
    key: "allowOrgContactAccess",
    title: "Contacto con veterinarias y fundaciones autorizadas",
    purpose:
      "Permite que una veterinaria o fundación autorizada pueda consultar tus datos de contacto cuando registre la recepción de una mascota asociada a tu cuenta, para coordinar la entrega. No habilita el acceso libre de ninguna otra organización.",
  },
  {
    key: "allowPublicPhone",
    title: "Mostrar mi número en el perfil público de mi mascota perdida",
    purpose:
      "Si tu mascota está reportada como perdida, quien escanee su placa o vea su perfil público podrá ver tu número de contacto. Nunca se muestra tu dirección ni tu correo. Al desactivarlo, el número deja de mostrarse.",
  },
  {
    key: "allowFoundPetContactSharing",
    title: "Compartir mi contacto si encuentro una mascota ajena",
    purpose:
      "Si reportas que encontraste una mascota identificable, autorizas a Huellas de Vuelta a compartir tu contacto con su propietario cuando sea necesario para el reencuentro. No significa que cualquier usuario pueda consultar tus datos.",
  },
];

const RIGHTS = [
  "Conocer, actualizar y rectificar tus datos personales.",
  "Solicitar prueba de la autorización otorgada.",
  "Ser informado sobre el uso que se ha dado a tus datos.",
  "Revocar la autorización y/o solicitar la supresión de los datos cuando no exista un deber legal o contractual de conservarlos.",
  "Acceder de forma gratuita a tus datos personales que hayan sido objeto de tratamiento.",
];

export default function PrivacySettings() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "no-session" | "error">("loading");
  const [prefs, setPrefs] = useState<PrivacyPreferences>({
    allowOrgContactAccess: false,
    allowPublicPhone: false,
    allowFoundPetContactSharing: false,
    updatedAt: null,
  });
  const [savedPrefs, setSavedPrefs] = useState<PrivacyPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [consents, setConsents] = useState<PolicyConsent[]>([]);

  // Eliminación de cuenta
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [blockers, setBlockers] = useState<DeletionBlocker[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setState("no-session");
        return;
      }
      try {
        const loaded = await fetchMyPrivacyPreferences(supabase);
        setPrefs(loaded);
        setSavedPrefs(loaded);
        setState("ready");
        try {
          setConsents(await fetchMyPolicyConsents(supabase));
        } catch {
          // El historial de consentimientos es informativo: si falla, no bloquea la pantalla.
          setConsents([]);
        }
      } catch {
        setState("error");
      }
    });
  }, []);

  const dirty =
    savedPrefs !== null &&
    (savedPrefs.allowOrgContactAccess !== prefs.allowOrgContactAccess ||
      savedPrefs.allowPublicPhone !== prefs.allowPublicPhone ||
      savedPrefs.allowFoundPetContactSharing !== prefs.allowFoundPetContactSharing);

  async function save() {
    setSaving(true);
    try {
      await saveMyPrivacyPreferences(createSupabaseBrowserClient(), prefs);
      setSavedPrefs(prefs);
      setToast({ variant: "success", message: "Preferencias de privacidad actualizadas." });
    } catch {
      setToast({ variant: "error", message: "No fue posible guardar las preferencias." });
    } finally {
      setSaving(false);
    }
  }

  async function openDelete() {
    setDeleteError(null);
    setConfirmWord("");
    setPassword("");
    try {
      const check = await accountDeletionPrecheck(createSupabaseBrowserClient());
      setBlockers(check.blockers);
      setCanDelete(check.canDelete);
    } catch {
      setBlockers([]);
      setCanDelete(false);
      setDeleteError("No fue posible verificar el estado de la cuenta.");
    }
    setDeleteOpen(true);
  }

  async function doDelete() {
    setDeleteError(null);
    if (confirmWord.trim().toUpperCase() !== "ELIMINAR") {
      setDeleteError('Escribe la palabra "ELIMINAR" para confirmar.');
      return;
    }
    if (!password) {
      setDeleteError("Ingresa tu contraseña actual.");
      return;
    }
    setDeleting(true);
    try {
      await requestAccountDeletion(createSupabaseBrowserClient(), {
        password,
        confirm: confirmWord.trim(),
      });
      await createSupabaseBrowserClient().auth.signOut();
      router.replace("/?cuenta=eliminada");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No fue posible eliminar la cuenta.");
      setDeleting(false);
    }
  }

  if (state === "loading") return <p className={controls.loading}>Cargando…</p>;
  if (state === "no-session") {
    return <p className={controls.empty}>Inicia sesión con una cuenta real para ver tus opciones de privacidad.</p>;
  }
  if (state === "error") {
    return <p className={controls.empty}>No fue posible cargar tus opciones de privacidad.</p>;
  }

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Privacidad</h1>
        <p className={styles.subtitle}>
          Autorizaciones sobre el tratamiento de tus datos personales, protección de datos y
          eliminación de cuenta.
        </p>
      </header>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Preferencias de privacidad</p>
        <p className={styles.note} style={{ marginTop: 0 }}>
          Cada opción es una autorización independiente y voluntaria. Todas están desactivadas por
          defecto y puedes retirarlas en cualquier momento. Los cambios se aplican en el servidor y
          quedan registrados con su fecha.
        </p>

        <div className={styles.list}>
          {PREFERENCES.map((p) => (
            <label key={p.key} className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={prefs[p.key]}
                onChange={(e) => setPrefs((cur) => ({ ...cur, [p.key]: e.target.checked }))}
              />
              <span className={styles.toggleBody}>
                <span className={styles.toggleTitle}>{p.title}</span>
                <span className={styles.toggleText}>{p.purpose}</span>
              </span>
            </label>
          ))}
        </div>

        <div className={styles.actionRow}>
          <button type="button" className={styles.linkButton} onClick={save} disabled={!dirty || saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Cómo se maneja tu información</p>
        <ul className={styles.plainList}>
          <li>Tu nombre, teléfonos, correo y dirección nunca se muestran en las páginas públicas.</li>
          <li>
            Los datos de una mascota son privados mientras esté «En casa». Al reportarla como perdida o
            publicarla en adopción se muestran su foto, nombre, especie, raza, color y edad — nunca
            datos tuyos, salvo el número que autorices arriba.
          </li>
          <li>
            La zona (ciudad y barrio) de un reporte es pública para ayudar a ubicar la mascota; no se
            pide ni se muestra la dirección exacta.
          </li>
          <li>La información médica de la mascota tiene reglas propias y no se abre por estas preferencias.</li>
          <li>Estas reglas están aplicadas en la base de datos (RLS) y en las consultas del servidor.</li>
        </ul>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Protección de datos personales</p>
        <p className={styles.note} style={{ marginTop: 0 }}>
          Como titular de tus datos personales tienes derecho a:
        </p>
        <ul className={styles.plainList}>
          {RIGHTS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className={styles.note}>
          Para ejercer estos derechos o consultar cómo tratamos tus datos, revisa la{" "}
          <Link href="/legal/tratamiento-de-datos" className={styles.inlineLink}>
            Política de Tratamiento de Datos Personales
          </Link>
          .
        </p>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Consentimiento otorgado</p>
        {consents.length === 0 ? (
          <p className={styles.note} style={{ marginTop: 0 }}>
            No hay un registro de aceptación asociado a esta cuenta todavía. Si corresponde, se te
            solicitará aceptar la versión vigente de la política al ingresar.
          </p>
        ) : (
          <ul className={styles.plainList}>
            {consents.map((c) => (
              <li key={`${c.policyType}-${c.policyVersion}-${c.acceptedAt}`}>
                {CONSENT_LABELS[c.policyType] ?? c.policyType} — versión {c.policyVersion}, aceptada el{" "}
                {formatConsentDate(c.acceptedAt)}.
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>
          Este registro es de solo lectura y se conserva como prueba de la autorización otorgada. Al
          publicarse una nueva versión de la política, se te pedirá aceptarla sin borrar el historial.
        </p>
      </div>

      <div className={`${styles.card} ${styles.dangerCard}`}>
        <p className={styles.cardTitle}>Eliminar mi cuenta</p>
        <p className={styles.note} style={{ marginTop: 0 }}>
          Esta acción eliminará o desvinculará la información de tu cuenta según las reglas de
          conservación aplicables. El correo quedará libre para registrarse de nuevo más adelante.
        </p>
        <div className={styles.actionRow}>
          <button type="button" className={styles.dangerButton} onClick={openDelete}>
            Eliminar cuenta
          </button>
        </div>
      </div>

      {deleteOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true" onClick={() => !deleting && setDeleteOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.modalTitle}>Eliminar cuenta</p>

            {blockers.length > 0 ? (
              <>
                <p className={styles.note} style={{ marginTop: 0 }}>
                  No puedes eliminar la cuenta todavía:
                </p>
                <ul className={styles.plainList}>
                  {blockers.map((b) => (
                    <li key={b.code}>{b.message}</li>
                  ))}
                </ul>
                <div className={styles.actionRow}>
                  <button type="button" className={styles.linkButton} onClick={() => setDeleteOpen(false)}>
                    Entendido
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.note} style={{ marginTop: 0 }}>
                  Esta acción no se puede deshacer. Para confirmar, escribe <strong>ELIMINAR</strong> y tu
                  contraseña actual.
                </p>
                <label className={styles.field}>
                  Escribe ELIMINAR
                  <input
                    className={styles.input}
                    value={confirmWord}
                    onChange={(e) => setConfirmWord(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className={styles.field}>
                  Contraseña actual
                  <input
                    className={styles.input}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                {deleteError && <p className={styles.error}>{deleteError}</p>}
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={doDelete}
                    disabled={deleting || !canDelete}
                  >
                    {deleting ? "Eliminando…" : "Eliminar mi cuenta definitivamente"}
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => setDeleteOpen(false)}
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </section>
  );
}
