"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import { veterinaryRepository } from "@/lib/veterinaries/repository";
import type { VeterinaryProfile } from "@/lib/veterinaries/types";
import controls from "@/components/ui/controls.module.css";

export default function VeterinariaMiPerfilPage() {
  const [state, setState] = useState<"loading" | "empty" | "ready">("loading");
  const [profile, setProfile] = useState<VeterinaryProfile | null>(null);

  useEffect(() => {
    resolvePanelSession().then(async (check) => {
      if (check.status === "unauthenticated") {
        setState("empty");
        return;
      }
      const mine = await veterinaryRepository.getMine(check.session.userId);
      if (mine) {
        setProfile(mine);
        setState("ready");
      } else {
        setState("empty");
      }
    });
  }, []);

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Mi perfil</h1>
        <p className={controls.pageSubtitle}>Así se verá la información de tu veterinaria cuando se publique.</p>
      </div>

      {state === "loading" && <p className={controls.loading}>Cargando…</p>}

      {state === "empty" && (
        <p className={controls.empty}>
          Todavía no has creado el perfil de tu veterinaria.{" "}
          <Link href="/veterinaria/perfil/crear">Crear perfil</Link>.
        </p>
      )}

      {state === "ready" && profile && (
        <>
          <div className={controls.buttonRow}>
            <Link href="/veterinaria/perfil/crear" className={controls.buttonSecondary}>Editar perfil</Link>
            <span className={controls.chip}>{profile.status === "published" ? "Publicado" : "Borrador"}</span>
            <span className={controls.chip}>
              {profile.approvalStatus === "approved" && profile.isActive
                ? "Verificado por administrador"
                : profile.approvalStatus === "approved" && !profile.isActive
                  ? "Inactiva"
                  : profile.approvalStatus === "rejected"
                    ? "Revisión rechazada"
                    : "En revisión"}
            </span>
          </div>
          {profile.status === "published" && !(profile.approvalStatus === "approved" && profile.isActive) && (
            <p className={controls.notice}>
              {profile.approvalStatus === "rejected"
                ? `Huellas de Vuelta no aprobó este perfil${profile.rejectionReason ? `: ${profile.rejectionReason}` : "."}`
                : profile.approvalStatus === "approved" && !profile.isActive
                  ? "Tu organización está actualmente inactiva y no aparece públicamente."
                  : "Tu perfil está publicado y en revisión. Aparecerá en el directorio público cuando el equipo de Huellas de Vuelta lo apruebe."}
            </p>
          )}

          <section className={controls.section}>
            <p className={controls.sectionTitle}>{profile.name}</p>
            <div className={controls.sectionBody}>
              {profile.description && <p>{profile.description}</p>}
              <p><strong>Dirección:</strong> {profile.location.address || "—"}{profile.location.city ? `, ${profile.location.city}` : ""}</p>
              <p><strong>Teléfono:</strong> {profile.phone || "—"} · <strong>WhatsApp:</strong> {profile.whatsapp || "—"}</p>
              <p><strong>Correo:</strong> {profile.email || "—"}</p>
              {profile.services.length > 0 && (
                <div className={controls.chips}>
                  {profile.services.map((service) => (
                    <span key={service} className={controls.chip}>{service}</span>
                  ))}
                </div>
              )}
              {profile.hours.length > 0 && (
                <ul style={{ display: "grid", gap: ".25rem", color: "var(--ink-600)", fontSize: ".9rem" }}>
                  {profile.hours.map((hour, index) => (
                    <li key={index}>{hour.day || "Horario"}: {hour.closed ? "Cerrado" : `${hour.open} – ${hour.close}`}</li>
                  ))}
                </ul>
              )}
              {profile.extraInfo && <p style={{ color: "var(--ink-600)" }}>{profile.extraInfo}</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
