"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { adminGetUser, adminListUsers, setUserAdmin, type AdminUserDetail } from "@/lib/supabase/adminUsers";
import { roleLabels } from "@/lib/auth/roles";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import styles from "./UserDetailCard.module.css";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const ORG_APPROVAL_LABEL: Record<string, string> = {
  pending: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export default function UserDetailCard({ userId }: { userId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [pending, setPending] = useState<{ makeAdmin: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(() => {
    return (async () => {
      setState("loading");
      const supabase = createSupabaseBrowserClient();
      try {
        const [detail, all] = await Promise.all([
          adminGetUser(supabase, userId),
          adminListUsers(supabase),
        ]);
        if (!detail) {
          setState("not-found");
          return;
        }
        setUser(detail);
        setAdminCount(all.filter((u) => u.isAdmin).length);
        setState("ready");
      } catch {
        setState("error");
      }
    })();
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmChange() {
    if (!pending || !user) return;
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await setUserAdmin(supabase, user.id, pending.makeAdmin);
      setToast({
        variant: "success",
        message: pending.makeAdmin ? "El usuario ahora es administrador." : "Se le quitó el rol de administrador.",
      });
      setPending(null);
      await load();
    } catch (error) {
      setToast({
        variant: "error",
        message: error instanceof Error ? error.message : "No fue posible cambiar el rol.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <p className={controls.loading}>Cargando usuario…</p>;
  if (state === "not-found") {
    return (
      <div>
        <Link className={styles.back} href="/admin/usuarios">← Volver a usuarios</Link>
        <p className={controls.empty}>No se encontró este usuario.</p>
      </div>
    );
  }
  if (state === "error" || !user) {
    return (
      <div>
        <Link className={styles.back} href="/admin/usuarios">← Volver a usuarios</Link>
        <p className={controls.empty}>No fue posible cargar el usuario.</p>
      </div>
    );
  }

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.displayName || "Sin nombre";
  const isLastAdmin = user.isAdmin && (adminCount ?? 0) <= 1;

  return (
    <div>
      <Link className={styles.back} href="/admin/usuarios">← Volver a usuarios</Link>

      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">{initialsFor(name)}</span>
          <div>
            <p className={styles.name}>{name}</p>
            <p className={styles.email}>{user.email ?? "sin correo"}</p>
            <span
              className={`${styles.badge} ${user.confirmedAt ? styles.badgeActive : styles.badgeSuspended}`}
            >
              {user.confirmedAt ? "Cuenta activa" : "Correo sin confirmar"}
            </span>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.field}>
            <p className={styles.fieldLabel}>Tipo de cuenta</p>
            <p className={styles.fieldValue}>
              {roleLabels[user.role] ?? user.role}{user.isAdmin ? " · Administrador" : ""}
            </p>
          </div>
          <div className={styles.field}>
            <p className={styles.fieldLabel}>Teléfono</p>
            <p className={styles.fieldValue}>{user.phone || "—"}</p>
          </div>
          <div className={styles.field}>
            <p className={styles.fieldLabel}>Registrado el</p>
            <p className={styles.fieldValue}>{formatDate(user.createdAt)}</p>
          </div>
          <div className={styles.field}>
            <p className={styles.fieldLabel}>Mascotas registradas</p>
            <p className={styles.fieldValue}>{user.petsCount}</p>
          </div>
          <div className={styles.field}>
            <p className={styles.fieldLabel}>Reportes activos</p>
            <p className={styles.fieldValue}>{user.activeReportsCount}</p>
          </div>
          {user.org && (
            <div className={styles.field}>
              <p className={styles.fieldLabel}>Organización</p>
              <p className={styles.fieldValue}>
                {user.org.name} · {ORG_APPROVAL_LABEL[user.org.approvalStatus] ?? user.org.approvalStatus}
                {user.org.isActive ? "" : " · Inactiva"}
              </p>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {user.isAdmin ? (
            <button
              type="button"
              className={styles.actionButton}
              style={{ cursor: isLastAdmin ? "not-allowed" : "pointer", opacity: isLastAdmin ? 0.6 : 1 }}
              disabled={isLastAdmin}
              title={isLastAdmin ? "No puedes quitar el rol al último administrador." : undefined}
              onClick={() => setPending({ makeAdmin: false })}
            >
              Quitar administrador
            </button>
          ) : (
            <button
              type="button"
              className={styles.actionButton}
              style={{ cursor: "pointer", opacity: 1 }}
              onClick={() => setPending({ makeAdmin: true })}
            >
              Convertir en administrador
            </button>
          )}
          {user.org && (
            <Link href="/admin/organizaciones" className={styles.actionButton} style={{ cursor: "pointer", opacity: 1 }}>
              Ver en Organizaciones
            </Link>
          )}
        </div>
        {user.role !== "usuario" && !user.org && (
          <p className={styles.note}>
            Esta cuenta es de tipo {roleLabels[user.role]} pero aún no ha creado el perfil de su organización.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.makeAdmin ? "Convertir en administrador" : "Quitar administrador"}
        message={
          pending?.makeAdmin
            ? `${name} tendrá acceso completo al área de administración.`
            : `${name} perderá el acceso al área de administración.`
        }
        confirmLabel={busy ? "Guardando…" : "Confirmar"}
        cancelLabel="Cancelar"
        onConfirm={confirmChange}
        onCancel={() => setPending(null)}
      />

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
