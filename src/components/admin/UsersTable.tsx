"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminUserStatus, AdminUserSummary } from "@/data/mockAdminUsers";
import { SearchIcon } from "@/components/icons/Icon";
import styles from "./UsersTable.module.css";

type StatusFilter = "all" | AdminUserStatus;

const STATUS_LABEL: Record<AdminUserStatus, string> = {
  active: "Activo",
  suspended: "Suspendido",
};

const STATUS_BADGE_CLASS: Record<AdminUserStatus, string> = {
  active: styles.badgeActive,
  suspended: styles.badgeSuspended,
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function UsersTable({ users }: { users: AdminUserSummary[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [users, query, statusFilter]);

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar por nombre o correo…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar usuarios"
        />
        <div className={styles.tabs} role="tablist" aria-label="Filtrar por estado">
          <button type="button" className={statusFilter === "all" ? styles.activeTab : styles.tab} onClick={() => setStatusFilter("all")}>
            Todos ({users.length})
          </button>
          <button type="button" className={statusFilter === "active" ? styles.activeTab : styles.tab} onClick={() => setStatusFilter("active")}>
            Activos ({users.filter((u) => u.status === "active").length})
          </button>
          <button type="button" className={statusFilter === "suspended" ? styles.activeTab : styles.tab} onClick={() => setStatusFilter("suspended")}>
            Suspendidos ({users.filter((u) => u.status === "suspended").length})
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <SearchIcon size={22} />
            <p style={{ marginTop: ".6rem" }}>No se encontraron usuarios con ese criterio.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Ubicación</th>
                <th>Mascotas</th>
                <th>Registrado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.userName}>{user.name}</span>
                      <span className={styles.userEmail}>{user.email}</span>
                    </div>
                  </td>
                  <td>{user.location}</td>
                  <td>{user.petsCount}</td>
                  <td>{formatDate(user.registeredAt)}</td>
                  <td>
                    <span className={`${styles.badge} ${STATUS_BADGE_CLASS[user.status]}`}>{STATUS_LABEL[user.status]}</span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <Link className={styles.actionLink} href={`/admin/usuarios/${user.id}`}>
                        Ver detalle
                      </Link>
                      <button
                        type="button"
                        className={styles.actionButton}
                        disabled
                        title="Esta acción se conecta a Supabase en la siguiente etapa."
                      >
                        {user.status === "active" ? "Suspender" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
