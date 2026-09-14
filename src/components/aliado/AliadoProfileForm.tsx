"use client";

import { type FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSupabaseUserId } from "@/lib/auth/session";
import Toast, { type ToastState } from "@/components/ui/Toast";
import { aliadoRepository } from "@/lib/aliados/repository";
import { EMPTY_ALIADO_INPUT, type AliadoProfileInput } from "@/lib/aliados/types";
import { deleteOrgLogo, getOrgLogoPublicUrl, uploadOrgLogo } from "@/lib/supabase/orgProfiles";
import OrgLogoInput, { type PreparedOrgLogo } from "@/components/organizacion/OrgLogoInput";
import controls from "@/components/ui/controls.module.css";

/**
 * Perfil de la cuenta aliada: logo, nombre (ya viene del registro, editable),
 * país, ciudad y dirección. Deliberadamente más simple que el de
 * veterinaria/fundación (sin horarios, servicios ni redes sociales).
 */
export default function AliadoProfileForm({ ownerId }: { ownerId: string }) {
  const [form, setForm] = useState<AliadoProfileInput>(EMPTY_ALIADO_INPUT);
  const [approval, setApproval] = useState<{ status: string; reason: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [logo, setLogo] = useState<PreparedOrgLogo | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [initialLogoPreview, setInitialLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    aliadoRepository
      .getMine(ownerId)
      .then((profile) => {
        if (profile) {
          setForm({
            name: profile.name,
            logoUrl: profile.logoUrl,
            logoPath: profile.logoPath,
            country: profile.country || "Colombia",
            city: profile.city,
            address: profile.address,
          });
          setApproval({ status: profile.approvalStatus, reason: profile.rejectionReason });
          if (profile.logoPath) {
            setInitialLogoPreview(getOrgLogoPublicUrl(createSupabaseBrowserClient(), profile.logoPath));
          } else if (profile.logoUrl) {
            setInitialLogoPreview(profile.logoUrl);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, [ownerId]);

  function set<K extends keyof AliadoProfileInput>(key: K, value: AliadoProfileInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setToast({ variant: "error", message: "El nombre de la empresa es obligatorio." });
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

      await aliadoRepository.saveMine(ownerId, {
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
      } else {
        setToast({ variant: "success", message: "Perfil de la empresa guardado." });
      }
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible guardar el perfil.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <p className={controls.loading}>Cargando…</p>;

  return (
    <form onSubmit={handleSubmit}>
      {approval && approval.status !== "approved" && (
        <p className={controls.notice}>
          {approval.status === "rejected"
            ? `Huellas de Vuelta no aprobó este perfil${approval.reason ? `: ${approval.reason}` : "."}`
            : "Tu perfil está en revisión por el equipo de Huellas de Vuelta."}
        </p>
      )}

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Identidad</p>
        <div className={controls.sectionBody}>
          <label className={controls.field}>
            Nombre de la empresa
            <input
              className={controls.input}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={120}
              required
            />
          </label>

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
          {logoError && <p className={controls.errorText}>{logoError}</p>}
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Ubicación</p>
        <div className={controls.sectionBody}>
          <div className={controls.row2}>
            <label className={controls.field}>
              País
              <input className={controls.input} value={form.country} onChange={(e) => set("country", e.target.value)} maxLength={80} />
            </label>
            <label className={controls.field}>
              Ciudad
              <input className={controls.input} value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
            </label>
          </div>
          <label className={controls.field}>
            Dirección
            <input className={controls.input} value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={160} />
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
