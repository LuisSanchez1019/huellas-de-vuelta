"use client";

import { type FormEvent, useEffect, useState } from "react";
import { accountProfileRepository } from "@/lib/profiles/repository";
import type { AccountProfile } from "@/lib/profiles/types";
import { roleLabels } from "@/lib/auth/roles";
import { isValidPhone } from "@/lib/phone";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchMyOrgName } from "@/lib/supabase/orgProfiles";
import Toast, { type ToastState } from "@/components/ui/Toast";
import { CheckIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "./profileForm.module.css";

function initials(first: string, last: string): string {
  const a = first.trim()[0] ?? "";
  const b = last.trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

/** Un teléfono alterno es opcional; si se escribe, se valida como el principal. */
function altPhoneProblem(value: string): string | null {
  if (!value.trim()) return null;
  return isValidPhone(value) ? null : "El teléfono alterno debe tener al menos 10 dígitos.";
}

export default function ProfileForm() {
  const [state, setState] = useState<"loading" | "ready" | "no-session" | "error">("loading");
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneAlt, setPhoneAlt] = useState("");
  const [orgName, setOrgName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const mine = await accountProfileRepository.getMine();
        if (!mine) {
          setState("no-session");
          return;
        }
        setProfile(mine);
        setFirstName(mine.firstName);
        setLastName(mine.lastName);
        setPhone(mine.phone);
        setPhoneAlt(mine.phoneAlt);
        if (mine.role === "veterinaria" || mine.role === "fundacion" || mine.role === "aliado") {
          try {
            setOrgName(await fetchMyOrgName(createSupabaseBrowserClient(), mine.id));
          } catch {
            /* si falla, no se muestra la fila */
          }
        }
        setState("ready");
      } catch {
        setState("error");
      }
    })();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setToast({ variant: "error", message: "El nombre y el apellido son obligatorios." });
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setToast({ variant: "error", message: "El teléfono debe tener al menos 10 dígitos." });
      return;
    }
    const altProblem = altPhoneProblem(phoneAlt);
    if (altProblem) {
      setToast({ variant: "error", message: altProblem });
      return;
    }
    setIsSaving(true);
    try {
      const updated = await accountProfileRepository.updateMine({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        phoneAlt: phoneAlt.trim(),
      });
      setProfile(updated);
      setToast({ variant: "success", message: "Perfil actualizado." });
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible guardar los cambios.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") return <p className={controls.loading}>Cargando…</p>;
  if (state === "no-session") {
    return <p className={controls.empty}>Inicia sesión con una cuenta real para ver tu perfil.</p>;
  }
  if (state === "error" || !profile) {
    return <p className={controls.empty}>No fue posible cargar tu perfil.</p>;
  }

  const isOrg = profile.role === "veterinaria" || profile.role === "fundacion" || profile.role === "aliado";

  return (
    <form onSubmit={handleSubmit}>
      <section className={controls.section}>
        <p className={controls.sectionTitle}>Datos personales</p>
        <div className={controls.sectionBody}>
          <div className={styles.identityRow}>
            <span className={styles.avatarFallback} aria-hidden="true">
              {initials(firstName, lastName)}
            </span>
            <span className={styles.identityHint}>
              Tu perfil se muestra con tus iniciales en toda la plataforma.
            </span>
          </div>

          <div className={controls.row2}>
            <label className={controls.field}>
              Nombre
              <input className={controls.input} value={firstName} maxLength={60} required
                onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className={controls.field}>
              Apellido
              <input className={controls.input} value={lastName} maxLength={60} required
                onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>
          <div className={controls.row2}>
            <label className={controls.field}>
              Teléfono principal
              <input className={controls.input} value={phone} maxLength={30} inputMode="tel"
                placeholder="(300) 123 4567"
                onChange={(e) => setPhone(e.target.value)} />
              <span className={controls.hint}>Mínimo 10 dígitos. Los espacios y guiones no cuentan.</span>
            </label>
            <label className={controls.field}>
              Teléfono alterno (opcional)
              <input className={controls.input} value={phoneAlt} maxLength={30} inputMode="tel"
                placeholder="(301) 765 4321"
                onChange={(e) => setPhoneAlt(e.target.value)} />
              <span className={controls.hint}>Puedes dejarlo vacío.</span>
            </label>
          </div>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Información de la cuenta</p>
        <div className={styles.readonlyGrid} style={{ marginTop: "1rem" }}>
          <div className={styles.readonlyItem}>
            <span className={styles.readonlyLabel}>Correo</span>
            <span className={styles.readonlyValue}>
              {profile.email ?? "—"}
              {profile.email && (
                <span className={profile.emailConfirmed ? styles.badgeOk : styles.badgeWarn}>
                  {profile.emailConfirmed ? (
                    <>
                      <CheckIcon size={11} /> Verificado
                    </>
                  ) : (
                    "Sin verificar"
                  )}
                </span>
              )}
            </span>
          </div>
          <div className={styles.readonlyItem}>
            <span className={styles.readonlyLabel}>Tipo de cuenta</span>
            <span className={styles.readonlyValue}>
              {roleLabels[profile.role]}
              {profile.isAdmin ? " · Administrador" : ""}
            </span>
          </div>
          {isOrg && (
            <div className={styles.readonlyItem}>
              <span className={styles.readonlyLabel}>
                {profile.role === "aliado" ? "Nombre de la empresa" : "Nombre de la organización"}
              </span>
              <span className={styles.readonlyValue}>{orgName || "—"}</span>
            </div>
          )}
          <div className={styles.readonlyItem}>
            <span className={styles.readonlyLabel}>Miembro desde</span>
            <span className={styles.readonlyValue}>{formatDate(profile.createdAt)}</span>
          </div>
        </div>
      </section>

      <div className={controls.buttonRow} style={{ marginTop: "1.5rem" }}>
        <button type="submit" className={controls.button} disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </form>
  );
}
