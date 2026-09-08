"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountProfileRepository } from "@/lib/profiles/repository";
import type { AccountProfile } from "@/lib/profiles/types";
import { roleLabels } from "@/lib/auth/roles";
import { CheckIcon } from "@/components/icons/Icon";
import controls from "@/components/ui/controls.module.css";
import styles from "./settings.module.css";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

export default function AccountSettings() {
  const [state, setState] = useState<"loading" | "ready" | "no-session" | "error">("loading");
  const [profile, setProfile] = useState<AccountProfile | null>(null);

  useEffect(() => {
    accountProfileRepository
      .getMine()
      .then((mine) => {
        if (!mine) {
          setState("no-session");
          return;
        }
        setProfile(mine);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "loading") return <p className={controls.loading}>Cargando…</p>;
  if (state === "no-session") {
    return <p className={controls.empty}>Inicia sesión con una cuenta real para ver tu cuenta.</p>;
  }
  if (state === "error" || !profile) {
    return <p className={controls.empty}>No fue posible cargar los datos de tu cuenta.</p>;
  }

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.displayName || "—";

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Configuración de cuenta</h1>
        <p className={styles.subtitle}>Datos generales de tu cuenta en Huellas de Vuelta.</p>
      </header>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Datos de la cuenta</p>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Correo</span>
          <span className={styles.infoValue}>{profile.email ?? "—"}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Estado del correo</span>
          <span className={styles.infoValue}>
            {profile.emailConfirmed ? (
              <span className={`${styles.badge} ${styles.badgeOk}`}><CheckIcon size={12} /> Verificado</span>
            ) : (
              <span className={`${styles.badge} ${styles.badgeWarn}`}>Sin verificar</span>
            )}
          </span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Nombre</span>
          <span className={styles.infoValue}>{fullName}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Teléfono</span>
          <span className={styles.infoValue}>{profile.phone || "—"}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Tipo de cuenta</span>
          <span className={styles.infoValue}>
            {roleLabels[profile.role]}{profile.isAdmin ? " · Administrador" : ""}
          </span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Miembro desde</span>
          <span className={styles.infoValue}>{formatDate(profile.createdAt)}</span>
        </div>
      </div>

      <p className={styles.note}>
        El tipo de cuenta lo define el sistema al registrarte y no se cambia desde aquí. Para editar tu
        nombre, teléfono o foto usa «Mi perfil».
      </p>

      <div className={styles.actionRow}>
        <Link href="/dashboard/perfil" className={styles.linkButton}>Editar mi perfil</Link>
      </div>
    </section>
  );
}
