"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { foundationRepository } from "@/lib/foundations/repository";
import { veterinaryRepository } from "@/lib/veterinaries/repository";
import { aliadoRepository } from "@/lib/aliados/repository";
import { fetchNotifications, markNotificationRead, type AppNotification } from "@/lib/supabase/notifications";
import { AlertIcon, CheckIcon, CloseIcon, ShieldIcon } from "@/components/icons/Icon";
import styles from "./orgStatusCard.module.css";

type Role = "veterinaria" | "fundacion" | "aliado";

interface OrgState {
  approvalStatus: "pending" | "approved" | "rejected";
  isActive: boolean;
  rejectionReason: string;
  status: "draft" | "published";
}

const CREATE_HREF: Record<Role, string> = {
  veterinaria: "/veterinaria/perfil/crear",
  fundacion: "/fundacion/perfil",
  aliado: "/aliado/perfil",
};

const ORG_NOUN: Record<Role, string> = {
  veterinaria: "tu veterinaria",
  fundacion: "tu fundación",
  aliado: "tu empresa",
};

const REPOSITORY_BY_ROLE = {
  veterinaria: veterinaryRepository,
  fundacion: foundationRepository,
  aliado: aliadoRepository,
} as const;

// El directorio público de aliados todavía no existe (§ aparte); su texto de
// aprobación no debe prometer visibilidad pública que hoy no ocurre.
const ACTIVE_TEXT: Record<Role, string> = {
  veterinaria: "Forma parte de nuestra red de ayuda para mascotas y aparece públicamente en el directorio del Landing.",
  fundacion: "Forma parte de nuestra red de ayuda para mascotas y aparece públicamente en el directorio del Landing.",
  aliado: "Tu perfil de empresa fue verificado por el equipo de Huellas de Vuelta.",
};
const PENDING_TEXT: Record<Role, string> = {
  veterinaria: "El equipo de Huellas de Vuelta revisará tu perfil. Aparecerá públicamente en el Landing cuando sea aprobada.",
  fundacion: "El equipo de Huellas de Vuelta revisará tu perfil. Aparecerá públicamente en el Landing cuando sea aprobada.",
  aliado: "El equipo de Huellas de Vuelta revisará el perfil de tu empresa.",
};

export default function OrgStatusCard({ role }: { role: Role }) {
  const [state, setState] = useState<"loading" | "no-profile" | OrgState>("loading");
  const [approvedNotice, setApprovedNotice] = useState<AppNotification | null>(null);

  useEffect(() => {
    let active = true;
    const repo = REPOSITORY_BY_ROLE[role];
    resolvePanelSession()
      .then(async (check) => {
        if (check.status === "unauthenticated" || check.status === "error") return null;
        return repo.getMine(check.session.userId);
      })
      .then((profile) => {
        if (!active) return;
        if (!profile) {
          setState("no-profile");
          return;
        }
        setState({
          approvalStatus: profile.approvalStatus,
          isActive: profile.isActive,
          rejectionReason: profile.rejectionReason,
          status: profile.status,
        });
      })
      .catch(() => {
        if (active) setState("no-profile");
      });
    return () => {
      active = false;
    };
  }, [role]);

  // Aviso TEMPORAL de "verificada" — reutiliza el sistema de notificaciones
  // existente en vez de mostrar el mensaje para siempre en el inicio. Se
  // muestra mientras la notificación siga sin leer y desaparece al cerrarlo.
  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    fetchNotifications(supabase, { unreadOnly: true, limit: 20 })
      .then((items) => {
        if (!active) return;
        const notice = items.find((n) => n.type === "org_approved") ?? null;
        setApprovedNotice(notice);
      })
      .catch(() => {
        /* silencioso: el aviso simplemente no aparece */
      });
    return () => {
      active = false;
    };
  }, []);

  async function dismissApprovedNotice() {
    if (!approvedNotice) return;
    const notice = approvedNotice;
    setApprovedNotice(null);
    try {
      await markNotificationRead(createSupabaseBrowserClient(), notice.id);
    } catch {
      /* si falla, el peor caso es que vuelva a aparecer una vez más */
    }
  }

  const approvedBanner = approvedNotice && (
    <div className={styles.approvedBanner} role="status">
      <CheckIcon size={16} className={styles.approvedBannerIcon} />
      <p className={styles.approvedBannerText}>{approvedNotice.body ?? approvedNotice.title}</p>
      <button
        type="button"
        className={styles.approvedBannerClose}
        aria-label="Cerrar aviso"
        onClick={dismissApprovedNotice}
      >
        <CloseIcon size={15} />
      </button>
    </div>
  );

  if (state === "loading") return approvedBanner ?? null;

  if (state === "no-profile") {
    return (
      <>
        {approvedBanner}
        <div className={`${styles.card} ${styles.neutral}`}>
          <div className={styles.body}>
            <p className={styles.title}>Bienvenido a Huellas de Vuelta</p>
            <p className={styles.text}>
              Crea el perfil de {ORG_NOUN[role]} para empezar a formar parte de nuestra red de ayuda
              para mascotas.
            </p>
          </div>
          <Link href={CREATE_HREF[role]} className={styles.action}>
            Crear perfil
          </Link>
        </div>
      </>
    );
  }

  if (state.approvalStatus === "approved" && state.isActive) {
    return (
      <>
        {approvedBanner}
        <div className={`${styles.card} ${styles.approved}`}>
          <span className={styles.icon} aria-hidden="true"><ShieldIcon size={22} /></span>
          <div className={styles.body}>
            <p className={styles.title}>Tu organización está activa</p>
            <p className={styles.text}>{ACTIVE_TEXT[role]}</p>
          </div>
        </div>
      </>
    );
  }

  if (state.approvalStatus === "approved" && !state.isActive) {
    return (
      <>
        {approvedBanner}
        <div className={`${styles.card} ${styles.warning}`}>
          <span className={styles.icon} aria-hidden="true"><AlertIcon size={22} /></span>
          <div className={styles.body}>
            <p className={styles.title}>Tu organización está actualmente inactiva</p>
            <p className={styles.text}>
              No aparece públicamente. Contacta al equipo de Huellas de Vuelta para reactivarla.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (state.approvalStatus === "rejected") {
    return (
      <>
        {approvedBanner}
        <div className={`${styles.card} ${styles.rejected}`}>
          <span className={styles.icon} aria-hidden="true"><AlertIcon size={22} /></span>
          <div className={styles.body}>
            <p className={styles.title}>Tu solicitud no fue aprobada</p>
            <p className={styles.text}>
              {state.rejectionReason
                ? `Motivo: ${state.rejectionReason}`
                : "Revisa y completa la información del perfil, y guarda de nuevo para una nueva revisión."}
            </p>
          </div>
        </div>
      </>
    );
  }

  // pending
  return (
    <>
      {approvedBanner}
      <div className={`${styles.card} ${styles.pending}`}>
        <span className={styles.icon} aria-hidden="true"><AlertIcon size={22} /></span>
        <div className={styles.body}>
          <p className={styles.title}>Tu organización está en revisión</p>
          <p className={styles.text}>{PENDING_TEXT[role]}</p>
        </div>
      </div>
    </>
  );
}
