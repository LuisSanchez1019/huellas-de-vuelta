"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSupabaseUserId } from "@/lib/auth/session";
import { isValidPhone } from "@/lib/phone";
import { ALLY_BRAND_POLICY_PATH } from "@/lib/legal/allyBrandPolicy";
import Toast, { type ToastState } from "@/components/ui/Toast";
import {
  aliadoRepository,
  fetchMyOrganizationAuthorizations,
  setOrganizationAuthorization,
} from "@/lib/aliados/repository";
import { EMPTY_ALIADO_INPUT, type AliadoProfileInput, type OrgAuthorizationType } from "@/lib/aliados/types";
import { BUSINESS_SECTORS } from "@/lib/aliados/sectors";
import { deleteOrgLogo, getOrgLogoPublicUrl, uploadOrgLogo } from "@/lib/supabase/orgProfiles";
import OrgLogoInput, { type PreparedOrgLogo } from "@/components/organizacion/OrgLogoInput";
import { ProfileSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";
import styles from "./aliadoProfile.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+$/i;

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

  const [authorizations, setAuthorizations] = useState<Record<OrgAuthorizationType, boolean>>({
    public_info: false,
    logo_usage: false,
  });
  const [authSaving, setAuthSaving] = useState<OrgAuthorizationType | null>(null);

  async function loadAuthorizations() {
    const list = await fetchMyOrganizationAuthorizations(ownerId).catch(() => []);
    setAuthorizations({
      public_info: list.some((a) => a.type === "public_info" && a.status === "granted"),
      logo_usage: list.some((a) => a.type === "logo_usage" && a.status === "granted"),
    });
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const profile = await aliadoRepository.getMine(ownerId);
      if (!active) return;
      if (profile) {
        setForm({
          name: profile.name,
          legalName: profile.legalName,
          description: profile.description,
          logoUrl: profile.logoUrl,
          logoPath: profile.logoPath,
          sectorId: profile.sectorId,
          country: profile.country || "Colombia",
          city: profile.city,
          address: profile.address,
          mapUrl: profile.mapUrl,
          website: profile.website,
          email: profile.email,
          phone: profile.phone,
          mobilePhone: profile.mobilePhone,
          whatsapp: profile.whatsapp,
        });
        setApproval({ status: profile.approvalStatus, reason: profile.rejectionReason });
        if (profile.logoPath) {
          setInitialLogoPreview(getOrgLogoPublicUrl(createSupabaseBrowserClient(), profile.logoPath));
        } else if (profile.logoUrl) {
          setInitialLogoPreview(profile.logoUrl);
        }
      }
      await loadAuthorizations();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  function set<K extends keyof AliadoProfileInput>(key: K, value: AliadoProfileInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function toggleAuthorization(type: OrgAuthorizationType, granted: boolean) {
    setAuthSaving(type);
    const previous = authorizations[type];
    setAuthorizations((current) => ({ ...current, [type]: granted }));
    try {
      await setOrganizationAuthorization(ownerId, type, granted);
      setToast({
        variant: "success",
        message: granted ? "Autorización otorgada." : "Autorización retirada.",
      });
    } catch (error) {
      setAuthorizations((current) => ({ ...current, [type]: previous }));
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible guardar la autorización.",
      });
    } finally {
      setAuthSaving(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setToast({ variant: "error", message: "El nombre de la empresa es obligatorio." });
      return;
    }
    if (form.email && !EMAIL_RE.test(form.email.trim())) {
      setToast({ variant: "error", message: "El correo empresarial no tiene un formato válido." });
      return;
    }
    if (form.phone && !isValidPhone(form.phone)) {
      setToast({ variant: "error", message: "El teléfono fijo debe tener al menos 10 dígitos." });
      return;
    }
    if (form.mobilePhone && !isValidPhone(form.mobilePhone)) {
      setToast({ variant: "error", message: "El celular debe tener al menos 10 dígitos." });
      return;
    }
    if (form.whatsapp && !isValidPhone(form.whatsapp)) {
      setToast({ variant: "error", message: "El número de WhatsApp debe tener al menos 10 dígitos." });
      return;
    }
    if (form.mapUrl && !URL_RE.test(form.mapUrl.trim())) {
      setToast({ variant: "error", message: "El enlace de Google Maps debe ser una URL http(s) válida." });
      return;
    }
    if (form.website && !URL_RE.test(form.website.trim())) {
      setToast({ variant: "error", message: "El sitio web debe ser una URL http(s) válida." });
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
        email: form.email.trim(),
        mapUrl: form.mapUrl.trim(),
        website: form.website.trim(),
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

  if (isLoading) return <ProfileSkeletonBody />;

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

          <label className={controls.field}>
            Razón social
            <input
              className={controls.input}
              value={form.legalName}
              onChange={(e) => set("legalName", e.target.value)}
              maxLength={160}
            />
          </label>

          <label className={controls.field}>
            Descripción breve
            <textarea
              className={controls.textarea}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={400}
              rows={3}
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
        <p className={controls.sectionTitle}>Información empresarial</p>
        <div className={controls.sectionBody}>
          <label className={controls.field}>
            Sector empresarial
            <select
              className={controls.select}
              value={form.sectorId ?? ""}
              onChange={(e) => set("sectorId", e.target.value || null)}
            >
              <option value="">Selecciona un sector…</option>
              {BUSINESS_SECTORS.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>

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
          <label className={controls.field}>
            Enlace de Google Maps
            <input
              className={controls.input}
              type="url"
              placeholder="https://maps.google.com/…"
              value={form.mapUrl}
              onChange={(e) => set("mapUrl", e.target.value)}
              maxLength={300}
            />
          </label>
          <label className={controls.field}>
            Sitio web
            <input
              className={controls.input}
              type="url"
              placeholder="https://…"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              maxLength={200}
            />
          </label>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Contacto empresarial</p>
        <div className={controls.sectionBody}>
          <label className={controls.field}>
            Correo empresarial
            <input
              className={controls.input}
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              maxLength={160}
            />
            <span className={controls.hint}>
              Este correo es el que verá el público; no tiene que ser el correo con el que inicias sesión.
            </span>
          </label>
          <div className={controls.row2}>
            <label className={controls.field}>
              Teléfono fijo
              <input className={controls.input} value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={20} />
            </label>
            <label className={controls.field}>
              Celular
              <input className={controls.input} value={form.mobilePhone} onChange={(e) => set("mobilePhone", e.target.value)} maxLength={20} />
            </label>
          </div>
          <label className={controls.field}>
            WhatsApp
            <input className={controls.input} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} maxLength={20} />
          </label>
        </div>
      </section>

      <section className={controls.section}>
        <p className={controls.sectionTitle}>Información y autorización de publicación</p>
        <div className={controls.sectionBody}>
          <div className={styles.infoBlock}>
            <p className={styles.infoTitle}>¿Para qué utilizaremos esta información?</p>
            <p className={styles.infoText}>
              La información empresarial que proporciones en esta sección será utilizada para gestionar
              tu participación como aliado de Huellas de Vuelta.
            </p>
            <p className={styles.infoText}>
              Cuando tu participación se encuentre activa, podremos mostrar en nuestra página principal
              información de tu empresa, como su nombre, logo, sector, ciudad y los datos de contacto que
              hayas autorizado para publicación.
            </p>
            <p className={styles.infoText}>
              Además, podremos incluir el logo de tu empresa en campañas, piezas de comunicación o
              actividades organizadas por Huellas de Vuelta como reconocimiento a tu apoyo, de acuerdo con
              las autorizaciones que selecciones.
            </p>
          </div>

          <label className={styles.consentRow}>
            <input
              type="checkbox"
              checked={authorizations.public_info}
              disabled={authSaving !== null}
              onChange={(e) => toggleAuthorization("public_info", e.target.checked)}
            />
            <span>
              Autorizo la publicación de la información empresarial que he seleccionado como pública en
              la plataforma de Huellas de Vuelta.
            </span>
          </label>

          <label className={styles.consentRow}>
            <input
              type="checkbox"
              checked={authorizations.logo_usage}
              disabled={authSaving !== null}
              onChange={(e) => toggleAuthorization("logo_usage", e.target.checked)}
            />
            <span>
              Autorizo el uso del logo de mi empresa en campañas, piezas de comunicación y actividades de
              Huellas de Vuelta como reconocimiento a nuestro apoyo.
            </span>
          </label>

          <p className={controls.hint}>
            Puedes otorgar o retirar cada autorización de forma independiente en cualquier momento; el
            cambio se aplica de inmediato.
          </p>

          <div className={styles.infoBlock}>
            <p className={styles.infoTitle}>Protección de la imagen y reputación de nuestros aliados</p>
            <p className={styles.infoText}>
              Huellas de Vuelta utilizará la información empresarial y el logo autorizados únicamente
              para las finalidades informadas en esta sección y dentro de las actividades relacionadas
              con la plataforma, sus campañas y su misión.
            </p>
            <p className={styles.infoText}>
              Nos comprometemos a utilizar la identidad de nuestros aliados de manera responsable y a
              evitar usos engañosos, ilícitos, ofensivos o ajenos a las finalidades informadas.
            </p>
            <p className={styles.infoText}>
              La presentación de una empresa como aliada no constituye una recomendación, certificación,
              garantía de calidad de sus productos o servicios ni una relación distinta de la que
              expresamente se haya informado.
            </p>
            <p className={styles.infoText}>
              Huellas de Vuelta podrá establecer criterios de publicación y retirar temporalmente una
              empresa de espacios públicos cuando sea necesario para proteger la integridad, seguridad,
              reputación y finalidad de la plataforma, respetando las condiciones aplicables y los
              derechos del aliado.
            </p>
          </div>

          <Link className={styles.policyLink} href={ALLY_BRAND_POLICY_PATH} target="_blank" rel="noopener noreferrer">
            Leer la Política de información y uso de marca de aliados
          </Link>
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
