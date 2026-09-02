"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import { foundationRepository } from "@/lib/foundations/repository";
import { veterinaryRepository } from "@/lib/veterinaries/repository";
import { AlertIcon, CheckIcon, ShieldIcon } from "@/components/icons/Icon";
import styles from "./orgStatusCard.module.css";

type Role = "veterinaria" | "fundacion";

interface OrgState {
  approvalStatus: "pending" | "approved" | "rejected";
  isActive: boolean;
  rejectionReason: string;
  status: "draft" | "published";
}

const CREATE_HREF: Record<Role, string> = {
  veterinaria: "/veterinaria/perfil/crear",
  fundacion: "/fundacion/perfil",
};

const ORG_NOUN: Record<Role, string> = {
  veterinaria: "tu veterinaria",
  fundacion: "tu fundación",
};

export default function OrgStatusCard({ role }: { role: Role }) {
  const [state, setState] = useState<"loading" | "no-profile" | OrgState>("loading");

  useEffect(() => {
    let active = true;
    const repo = role === "veterinaria" ? veterinaryRepository : foundationRepository;
    resolvePanelSession()
      .then(async (check) => {
        if (check.status === "unauthenticated") return null;
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

  if (state === "loading") return null;

  if (state === "no-profile") {
    return (
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
    );
  }

  if (state.approvalStatus === "approved" && state.isActive) {
    return (
      <div className={`${styles.card} ${styles.approved}`}>
        <span className={styles.icon} aria-hidden="true"><ShieldIcon size={22} /></span>
        <div className={styles.body}>
          <p className={styles.title}>
            <span className={styles.verifiedBadge}>
              <CheckIcon size={13} /> Verificado por administrador
            </span>
          </p>
          <p className={styles.text}>
            Tu organización ya forma parte de nuestra red de ayuda para mascotas y aparece
            públicamente en el directorio del Landing.
          </p>
        </div>
      </div>
    );
  }

  if (state.approvalStatus === "approved" && !state.isActive) {
    return (
      <div className={`${styles.card} ${styles.warning}`}>
        <span className={styles.icon} aria-hidden="true"><AlertIcon size={22} /></span>
        <div className={styles.body}>
          <p className={styles.title}>Tu organización está actualmente inactiva</p>
          <p className={styles.text}>
            No aparece públicamente. Contacta al equipo de Huellas de Vuelta para reactivarla.
          </p>
        </div>
      </div>
    );
  }

  if (state.approvalStatus === "rejected") {
    return (
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
    );
  }

  // pending
  return (
    <div className={`${styles.card} ${styles.pending}`}>
      <span className={styles.icon} aria-hidden="true"><AlertIcon size={22} /></span>
      <div className={styles.body}>
        <p className={styles.title}>Tu organización está en revisión</p>
        <p className={styles.text}>
          El equipo de Huellas de Vuelta revisará tu perfil. Aparecerá públicamente en el Landing
          cuando sea aprobada.
        </p>
      </div>
    </div>
  );
}
