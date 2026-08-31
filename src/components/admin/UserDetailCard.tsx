import Link from "next/link";
import type { AdminUserSummary } from "@/data/mockAdminUsers";
import styles from "./UserDetailCard.module.css";

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function UserDetailCard({ user }: { user: AdminUserSummary }) {
  return (
    <div>
      <Link className={styles.back} href="/admin/usuarios">← Volver a usuarios</Link>

      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">{initialsFor(user.name)}</span>
          <div>
            <p className={styles.name}>{user.name}</p>
            <p className={styles.email}>{user.email}</p>
            <span className={`${styles.badge} ${user.status === "active" ? styles.badgeActive : styles.badgeSuspended}`}>
              {user.status === "active" ? "Activo" : "Suspendido"}
            </span>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.field}>
            <p className={styles.fieldLabel}>Ubicación</p>
            <p className={styles.fieldValue}>{user.location}</p>
          </div>
          <div className={styles.field}>
            <p className={styles.fieldLabel}>Mascotas registradas</p>
            <p className={styles.fieldValue}>{user.petsCount}</p>
          </div>
          <div className={styles.field}>
            <p className={styles.fieldLabel}>Registrado el</p>
            <p className={styles.fieldValue}>{formatDate(user.registeredAt)}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.actionButton} disabled>
            {user.status === "active" ? "Suspender cuenta" : "Activar cuenta"}
          </button>
          <button type="button" className={styles.actionButton} disabled>
            Ver mascotas del usuario
          </button>
        </div>
        <p className={styles.note}>Estas acciones se conectarán a Supabase cuando implementemos las funcionalidades de este módulo.</p>
      </div>
    </div>
  );
}
