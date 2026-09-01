"use client";

import { type FormEvent, useEffect, useState } from "react";
import Toast, { type ToastState } from "@/components/ui/Toast";
import { foundationRepository } from "@/lib/foundations/repository";
import { EMPTY_FOUNDATION_INPUT, type FoundationProfileInput } from "@/lib/foundations/types";
import controls from "@/components/ui/controls.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FoundationProfileForm({ ownerId }: { ownerId: string }) {
  const [form, setForm] = useState<FoundationProfileInput>(EMPTY_FOUNDATION_INPUT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    foundationRepository
      .getMine(ownerId)
      .then((profile) => {
        if (profile) {
          const { id, ownerId: _o, slug, createdAt, updatedAt, ...input } = profile;
          void id;
          void _o;
          void slug;
          void createdAt;
          void updatedAt;
          setForm(input);
        }
      })
      .finally(() => setIsLoading(false));
  }, [ownerId]);

  function set<K extends keyof FoundationProfileInput>(key: K, value: FoundationProfileInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function setSocial(key: keyof FoundationProfileInput["social"], value: string) {
    setForm((current) => ({ ...current, social: { ...current.social, [key]: value } }));
  }
  function setLocation<K extends keyof FoundationProfileInput["location"]>(
    key: K,
    value: FoundationProfileInput["location"][K],
  ) {
    setForm((current) => ({ ...current, location: { ...current.location, [key]: value } }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setToast({ variant: "error", message: "El nombre de la fundación es obligatorio." });
      return;
    }
    if (form.email && !EMAIL_RE.test(form.email)) {
      setToast({ variant: "error", message: "El correo no tiene un formato válido." });
      return;
    }
    setIsSaving(true);
    try {
      await foundationRepository.saveMine(ownerId, { ...form, name: form.name.trim() });
      setToast({ variant: "success", message: "Perfil de la fundación guardado." });
    } catch {
      setToast({ variant: "error", message: "No fue posible guardar el perfil." });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <p className={controls.loading}>Cargando…</p>;

  return (
    <form onSubmit={handleSubmit}>
      <section className={controls.section}>
        <p className={controls.sectionTitle}>Identidad</p>
        <div className={controls.sectionBody}>
          <label className={controls.field}>
            Nombre de la fundación
            <input className={controls.input} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required />
          </label>
          <label className={controls.field}>
            Logo (URL)
            <input className={controls.input} value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…" />
          </label>
          <label className={controls.field}>
            Descripción
            <textarea className={controls.textarea} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={600} rows={4} />
          </label>
          <label className={controls.field}>
            Estado del perfil
            <select className={controls.select} value={form.status} onChange={(e) => set("status", e.target.value as FoundationProfileInput["status"])}>
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
            <label className={controls.field}>Teléfono<input className={controls.input} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
            <label className={controls.field}>WhatsApp<input className={controls.input} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></label>
          </div>
          <label className={controls.field}>Correo<input className={controls.input} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Ubicación</p>
        <div className={controls.sectionBody}>
          <div className={controls.row2}>
            <label className={controls.field}>Dirección<input className={controls.input} value={form.location.address} onChange={(e) => setLocation("address", e.target.value)} /></label>
            <label className={controls.field}>Ciudad<input className={controls.input} value={form.location.city} onChange={(e) => setLocation("city", e.target.value)} /></label>
          </div>
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
          <p className={controls.field}><span className={controls.hint}>Latitud y longitud se usarán para ubicar tu fundación en el mapa de la página principal.</span></p>
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
        <p className={controls.sectionTitle}>Información adicional</p>
        <div className={controls.sectionBody}>
          <label className={controls.field}>
            <span className="sr-only">Información adicional</span>
            <textarea className={controls.textarea} value={form.extraInfo} onChange={(e) => set("extraInfo", e.target.value)} maxLength={600} rows={3} placeholder="Cómo colaborar, jornadas, convenios…" />
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
