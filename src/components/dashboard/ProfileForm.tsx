"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { accountProfileRepository, getAvatarPublicUrl } from "@/lib/profiles/repository";
import type { AccountProfile } from "@/lib/profiles/types";
import { roleLabels } from "@/lib/auth/roles";
import { isValidPhone } from "@/lib/phone";
import { resizeImage } from "@/lib/images/resizeImage";
import Toast, { type ToastState } from "@/components/ui/Toast";
import { CameraIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "./profileForm.module.css";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 3 * 1024 * 1024;

function monogram(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

export default function ProfileForm() {
  const [state, setState] = useState<"loading" | "ready" | "no-session" | "error">("loading");
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<{ blob: Blob; contentType: string; preview: string } | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
        setAvatarUrl(mine.avatarPath ? getAvatarPublicUrl(mine.avatarPath) : null);
        setState("ready");
      } catch {
        setState("error");
      }
    })();
  }, []);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setToast({ variant: "error", message: "Formato no permitido. Usa JPG, PNG o WebP." });
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setToast({ variant: "error", message: "La imagen supera 3 MB. Elige una más liviana." });
      return;
    }
    try {
      const resized = await resizeImage(file, { maxDimension: 256 });
      setPendingAvatar({ blob: resized.blob, contentType: resized.contentType, preview: resized.previewUrl });
      setAvatarRemoved(false);
    } catch {
      setToast({ variant: "error", message: "No fue posible procesar la imagen." });
    }
  }

  function removeAvatar() {
    setPendingAvatar(null);
    setAvatarRemoved(true);
  }

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
    setIsSaving(true);
    try {
      let avatarPath: string | null | undefined = undefined;
      if (pendingAvatar) {
        avatarPath = await accountProfileRepository.uploadAvatar(pendingAvatar.blob, pendingAvatar.contentType);
        if (profile?.avatarPath) await accountProfileRepository.deleteAvatar(profile.avatarPath);
      } else if (avatarRemoved && profile?.avatarPath) {
        await accountProfileRepository.deleteAvatar(profile.avatarPath);
        avatarPath = null;
      }

      const updated = await accountProfileRepository.updateMine({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        avatarPath,
      });
      setProfile(updated);
      setAvatarUrl(updated.avatarPath ? getAvatarPublicUrl(updated.avatarPath) : null);
      setPendingAvatar(null);
      setAvatarRemoved(false);
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

  const shownAvatar = pendingAvatar ? pendingAvatar.preview : avatarRemoved ? null : avatarUrl;

  return (
    <form onSubmit={handleSubmit}>
      <section className={controls.section}>
        <p className={controls.sectionTitle}>Foto de perfil</p>
        <div className={controls.sectionBody}>
          <div className={styles.avatarRow}>
            {shownAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar público de Supabase Storage
              <img src={shownAvatar} alt="Tu avatar" className={styles.avatar} />
            ) : (
              <span className={styles.avatarFallback} aria-hidden="true">
                {monogram(`${firstName} ${lastName}`)}
              </span>
            )}
            <div className={styles.avatarActions}>
              <button
                type="button"
                className={styles.avatarButton}
                onClick={() => fileRef.current?.click()}
                disabled={isSaving}
              >
                <CameraIcon size={14} /> {shownAvatar ? "Cambiar" : "Subir foto"}
              </button>
              {shownAvatar && (
                <button type="button" className={styles.avatarButtonDanger} onClick={removeAvatar} disabled={isSaving}>
                  Quitar
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={styles.hiddenInput}
              onChange={handleFile}
              disabled={isSaving}
            />
          </div>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Datos personales</p>
        <div className={controls.sectionBody}>
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
          <label className={controls.field}>
            Teléfono
            <input className={controls.input} value={phone} maxLength={30} inputMode="tel"
              placeholder="(300) 123 4567"
              onChange={(e) => setPhone(e.target.value)} />
            <span className={controls.hint}>Mínimo 10 dígitos. Los espacios y guiones no cuentan.</span>
          </label>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Información de la cuenta</p>
        <div className={styles.readonlyGrid} style={{ marginTop: "1rem" }}>
          <div className={styles.readonlyItem}>
            <span className={styles.readonlyLabel}>Correo</span>
            <span className={styles.readonlyValue}>{profile.email ?? "—"}</span>
          </div>
          <div className={styles.readonlyItem}>
            <span className={styles.readonlyLabel}>Tipo de cuenta</span>
            <span className={styles.readonlyValue}>
              {roleLabels[profile.role]}{profile.isAdmin ? " · Administrador" : ""}
            </span>
          </div>
          <div className={styles.readonlyItem}>
            <span className={styles.readonlyLabel}>Miembro desde</span>
            <span className={styles.readonlyValue}>{formatDate(profile.createdAt)}</span>
          </div>
        </div>
        <p className={controls.hint} style={{ marginTop: ".75rem" }}>
          El correo y el tipo de cuenta no se cambian desde aquí. Para cambiar el correo usa el flujo de
          Supabase; el tipo de cuenta lo define el sistema.
        </p>
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
