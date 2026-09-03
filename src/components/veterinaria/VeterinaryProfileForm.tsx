"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSupabaseUserId } from "@/lib/auth/session";
import Toast, { type ToastState } from "@/components/ui/Toast";
import { veterinaryRepository } from "@/lib/veterinaries/repository";
import {
  EMPTY_VETERINARY_INPUT,
  type OrgCategory,
  type VeterinaryHours,
  type VeterinaryProfileInput,
} from "@/lib/veterinaries/types";
import {
  deleteOrgLogo,
  getOrgLogoPublicUrl,
  uploadOrgLogo,
} from "@/lib/supabase/orgProfiles";
import OrgLogoInput, { type PreparedOrgLogo } from "@/components/organizacion/OrgLogoInput";
import controls from "@/components/ui/controls.module.css";
import styles from "./vetProfileForm.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CATEGORY_OPTIONS: { value: OrgCategory; label: string }[] = [
  { value: "veterinaria", label: "Veterinaria" },
  { value: "otro_aliado", label: "Otro aliado" },
];

export default function VeterinaryProfileForm({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<VeterinaryProfileInput>(EMPTY_VETERINARY_INPUT);
  const [serviceDraft, setServiceDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [logo, setLogo] = useState<PreparedOrgLogo | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [initialLogoPreview, setInitialLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    veterinaryRepository
      .getMine(ownerId)
      .then((profile) => {
        if (profile) {
          const {
            id, ownerId: _ownerId, slug, createdAt, updatedAt,
            approvalStatus, isActive, rejectionReason, ...input
          } = profile;
          void id; void _ownerId; void slug; void createdAt; void updatedAt;
          void approvalStatus; void isActive; void rejectionReason;
          setForm(input);
          if (input.logoPath) {
            setInitialLogoPreview(getOrgLogoPublicUrl(createSupabaseBrowserClient(), input.logoPath));
          } else if (input.logoUrl) {
            setInitialLogoPreview(input.logoUrl);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, [ownerId]);

  function set<K extends keyof VeterinaryProfileInput>(key: K, value: VeterinaryProfileInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function setSocial(key: keyof VeterinaryProfileInput["social"], value: string) {
    setForm((current) => ({ ...current, social: { ...current.social, [key]: value } }));
  }
  function setLocation<K extends keyof VeterinaryProfileInput["location"]>(
    key: K,
    value: VeterinaryProfileInput["location"][K],
  ) {
    setForm((current) => ({ ...current, location: { ...current.location, [key]: value } }));
  }

  function updateHour(index: number, patch: Partial<VeterinaryHours>) {
    setForm((current) => ({
      ...current,
      hours: current.hours.map((hour, i) => (i === index ? { ...hour, ...patch } : hour)),
    }));
  }
  function addHour() {
    set("hours", [...form.hours, { day: "", open: "08:00", close: "18:00", closed: false }]);
  }
  function removeHour(index: number) {
    set("hours", form.hours.filter((_, i) => i !== index));
  }

  function addService() {
    const value = serviceDraft.trim();
    if (!value || form.services.includes(value)) {
      setServiceDraft("");
      return;
    }
    set("services", [...form.services, value]);
    setServiceDraft("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setToast({ variant: "error", message: "El nombre de la veterinaria es obligatorio." });
      return;
    }
    if (form.email && !EMAIL_RE.test(form.email)) {
      setToast({ variant: "error", message: "El correo no tiene un formato válido." });
      return;
    }
    if (logoError) {
      setToast({ variant: "error", message: logoError });
      return;
    }
    setIsSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const hasSession = Boolean(await getSupabaseUserId());
      let logoPath = form.logoPath;
      let logoFailed = false;

      // La subida del logo NUNCA debe impedir guardar el resto del perfil.
      if (hasSession && logo) {
        try {
          const newPath = await uploadOrgLogo(supabase, ownerId, logo.blob, logo.contentType);
          if (form.logoPath && form.logoPath !== newPath) await deleteOrgLogo(supabase, form.logoPath);
          logoPath = newPath;
        } catch {
          logoFailed = true;
        }
      } else if (hasSession && logoRemoved && form.logoPath) {
        await deleteOrgLogo(supabase, form.logoPath);
        logoPath = "";
      } else if (!hasSession) {
        logoPath = logoRemoved ? "" : form.logoPath;
      }

      await veterinaryRepository.saveMine(ownerId, {
        ...form,
        name: form.name.trim(),
        logoPath,
        logoUrl: logoPath ? "" : form.logoUrl,
      });

      if (logoFailed) {
        setToast({
          variant: "error",
          message: "El perfil se guardó, pero no se pudo subir el logo. Vuelve a intentarlo.",
        });
        setLogo(null);
        setIsSaving(false);
        return;
      }
      setToast({ variant: "success", message: "Perfil guardado correctamente." });
      setTimeout(() => router.push("/veterinaria/perfil"), 900);
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible guardar el perfil.",
      });
      setIsSaving(false);
    }
  }

  if (isLoading) return <p className={controls.loading}>Cargando…</p>;

  return (
    <form onSubmit={handleSubmit}>
      <p className={controls.notice}>
        Será público en el directorio del Landing: nombre, tipo de organización, logo, descripción,
        ciudad, barrio o zona, dirección, teléfono, horario, servicios y ubicación del mapa. Tu correo
        de acceso y los datos privados de la cuenta no se publican.
      </p>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Identidad</p>
        <div className={controls.sectionBody}>
          <div className={controls.row2}>
            <label className={controls.field}>
              Nombre de la veterinaria
              <input className={controls.input} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required />
            </label>
            <label className={controls.field}>
              Tipo de organización
              <select className={controls.select} value={form.category} onChange={(e) => set("category", e.target.value as OrgCategory)}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>

          <OrgLogoInput
            initialPreviewUrl={initialLogoPreview}
            onChange={(next, removed) => {
              setLogo(next);
              setLogoRemoved(removed);
              setLogoError(null);
            }}
            onError={setLogoError}
            disabled={isSaving}
          />
          {logoError && <p className={controls.field} style={{ color: "#8b3023", fontWeight: 700 }}>{logoError}</p>}

          <label className={controls.field}>
            Imagen principal (URL, opcional)
            <input className={controls.input} value={form.coverImageUrl} onChange={(e) => set("coverImageUrl", e.target.value)} placeholder="https://…" />
          </label>
          <label className={controls.field}>
            Descripción
            <textarea className={controls.textarea} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={600} rows={4} />
          </label>
          <label className={controls.field}>
            Estado del perfil
            <select className={controls.select} value={form.status} onChange={(e) => set("status", e.target.value as VeterinaryProfileInput["status"])}>
              <option value="draft">Borrador (no visible en la landing)</option>
              <option value="published">Publicado (visible en la landing)</option>
            </select>
          </label>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Contacto</p>
        <div className={controls.sectionBody}>
          <div className={controls.row2}>
            <label className={controls.field}>
              Teléfono
              <input className={controls.input} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label className={controls.field}>
              WhatsApp
              <input className={controls.input} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            </label>
          </div>
          <label className={controls.field}>
            Correo
            <input className={controls.input} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </label>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Horarios</p>
        <div className={controls.sectionBody}>
          {form.hours.map((hour, index) => (
            <div key={index} className={styles.hourRow}>
              <input className={controls.input} value={hour.day} placeholder="Lunes a viernes" onChange={(e) => updateHour(index, { day: e.target.value })} />
              <input className={controls.input} type="time" value={hour.open} disabled={hour.closed} onChange={(e) => updateHour(index, { open: e.target.value })} />
              <input className={controls.input} type="time" value={hour.close} disabled={hour.closed} onChange={(e) => updateHour(index, { close: e.target.value })} />
              <label className={styles.closedToggle}>
                <input type="checkbox" checked={hour.closed} onChange={(e) => updateHour(index, { closed: e.target.checked })} />
                Cerrado
              </label>
              <button type="button" className={controls.buttonSecondary} onClick={() => removeHour(index)}>Quitar</button>
            </div>
          ))}
          <button type="button" className={controls.buttonSecondary} onClick={addHour}>+ Agregar horario</button>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Servicios</p>
        <div className={controls.sectionBody}>
          <div className={styles.serviceAdd}>
            <input
              className={controls.input}
              value={serviceDraft}
              onChange={(e) => setServiceDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addService();
                }
              }}
              placeholder="Vacunación, cirugía, urgencias…"
            />
            <button type="button" className={controls.buttonSecondary} onClick={addService}>Agregar</button>
          </div>
          {form.services.length > 0 && (
            <div className={controls.chips}>
              {form.services.map((service) => (
                <span key={service} className={controls.chip}>
                  {service}
                  <button
                    type="button"
                    className={controls.chipRemove}
                    aria-label={`Quitar ${service}`}
                    onClick={() => set("services", form.services.filter((s) => s !== service))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Redes sociales</p>
        <div className={`${controls.sectionBody} ${controls.row2}`}>
          <label className={controls.field}>Facebook<input className={controls.input} value={form.social.facebook} onChange={(e) => setSocial("facebook", e.target.value)} /></label>
          <label className={controls.field}>Instagram<input className={controls.input} value={form.social.instagram} onChange={(e) => setSocial("instagram", e.target.value)} /></label>
          <label className={controls.field}>WhatsApp (enlace)<input className={controls.input} value={form.social.whatsapp} onChange={(e) => setSocial("whatsapp", e.target.value)} /></label>
          <label className={controls.field}>Sitio web<input className={controls.input} value={form.social.website} onChange={(e) => setSocial("website", e.target.value)} /></label>
          <label className={controls.field}>TikTok<input className={controls.input} value={form.social.tiktok} onChange={(e) => setSocial("tiktok", e.target.value)} /></label>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Ubicación</p>
        <div className={controls.sectionBody}>
          <div className={controls.row2}>
            <label className={controls.field}>Dirección<input className={controls.input} value={form.location.address} onChange={(e) => setLocation("address", e.target.value)} /></label>
            <label className={controls.field}>Ciudad<input className={controls.input} value={form.location.city} onChange={(e) => setLocation("city", e.target.value)} /></label>
          </div>
          <label className={controls.field}>Barrio o zona<input className={controls.input} value={form.location.neighborhood} onChange={(e) => setLocation("neighborhood", e.target.value)} /></label>
          <label className={controls.field}>Enlace del mapa<input className={controls.input} value={form.location.mapUrl} onChange={(e) => setLocation("mapUrl", e.target.value)} placeholder="https://maps.google.com/…" /></label>
          <div className={controls.row2}>
            <label className={controls.field}>
              Latitud
              <input className={controls.input} type="number" step="any" inputMode="decimal" value={form.location.lat ?? ""} onChange={(e) => setLocation("lat", e.target.value === "" ? null : Number(e.target.value))} placeholder="7.1193" />
            </label>
            <label className={controls.field}>
              Longitud
              <input className={controls.input} type="number" step="any" inputMode="decimal" value={form.location.lng ?? ""} onChange={(e) => setLocation("lng", e.target.value === "" ? null : Number(e.target.value))} placeholder="-73.1227" />
            </label>
          </div>
          <p className={controls.field}><span className={controls.hint}>Latitud y longitud se usarán para ubicar tu veterinaria en el mapa de la página principal.</span></p>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Información adicional</p>
        <div className={controls.sectionBody}>
          <label className={controls.field}>
            <span className="sr-only">Información adicional</span>
            <textarea className={controls.textarea} value={form.extraInfo} onChange={(e) => set("extraInfo", e.target.value)} maxLength={600} rows={3} placeholder="Parqueadero, atención a domicilio, convenios…" />
          </label>
        </div>
      </section>

      <div className={controls.buttonRow} style={{ marginTop: "1.5rem" }}>
        <button type="submit" className={controls.button} disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar perfil"}
        </button>
      </div>

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </form>
  );
}
