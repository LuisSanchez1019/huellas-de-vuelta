"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { adminListUsers, setUserAdmin, type AdminUser } from "@/lib/supabase/adminUsers";
import { roleLabels } from "@/lib/auth/roles";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast, { type ToastState } from "@/components/ui/Toast";
import controls from "@/components/ui/controls.module.css";
import tableStyles from "./usuarios.module.css";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function fullName(user: AdminUser): string {
  const composed = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return composed || user.displayName || "Sin nombre";
}

export default function AdminUsersPage() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<{ user: AdminUser; makeAdmin: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(() => {
    return Promise.resolve().then(async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        setUsers(await adminListUsers(supabase));
        setState("ready");
      } catch {
        setState("error");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => fullName(u).toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  const adminCount = users.filter((u) => u.isAdmin).length;

  async function confirmChange() {
    if (!pending) return;
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await setUserAdmin(supabase, pending.user.id, pending.makeAdmin);
      setToast({
        variant: "success",
        message: pending.makeAdmin
          ? `${fullName(pending.user)} ahora es administrador.`
          : `${fullName(pending.user)} ya no es administrador.`,
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

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Usuarios</h1>
        <p className={controls.pageSubtitle}>
          Cuentas registradas en la plataforma. Desde aquí puedes convertir a un usuario existente en
          administrador o quitarle el rol. No se crean cuentas nuevas.
        </p>
      </div>

      {state === "loading" && <p className={controls.loading}>Cargando…</p>}
      {state === "error" && <p className={controls.empty}>No fue posible cargar los usuarios.</p>}

      {state === "ready" && (
        <>
          <input
            className={tableStyles.search}
            type="search"
            placeholder="Buscar por nombre o correo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar usuarios"
          />
          <div className={tableStyles.tableWrap}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Mascotas</th>
                  <th>Registrado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const isLastAdmin = user.isAdmin && adminCount <= 1;
                  return (
                    <tr key={user.id}>
                      <td>
                        <Link href={`/admin/usuarios/${user.id}`} className={tableStyles.name}>
                          {fullName(user)}
                        </Link>
                        <span className={tableStyles.sub}>{roleLabels[user.role] ?? user.role}</span>
                      </td>
                      <td>{user.email ?? "sin correo"}</td>
                      <td>
                        <span className={`${tableStyles.roleTag} ${user.isAdmin ? tableStyles.roleAdmin : tableStyles.roleUser}`}>
                          {user.isAdmin ? "ADMIN" : "USUARIO"}
                        </span>
                      </td>
                      <td>
                        <span className={user.confirmedAt ? tableStyles.stateActive : tableStyles.statePending}>
                          {user.confirmedAt ? "Activa" : "Sin confirmar"}
                        </span>
                      </td>
                      <td>{user.petsCount}</td>
                      <td>{user.createdAt ? formatDate(user.createdAt) : "—"}</td>
                      <td>
                        {user.isAdmin ? (
                          <button
                            type="button"
                            className={tableStyles.demote}
                            disabled={isLastAdmin}
                            title={isLastAdmin ? "No puedes quitar el rol al último administrador." : undefined}
                            onClick={() => setPending({ user, makeAdmin: false })}
                          >
                            Quitar administrador
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={tableStyles.promote}
                            onClick={() => setPending({ user, makeAdmin: true })}
                          >
                            Convertir en administrador
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className={tableStyles.empty}>No se encontraron usuarios con ese criterio.</p>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.makeAdmin ? "Convertir en administrador" : "Quitar administrador"}
        message={
          pending
            ? pending.makeAdmin
              ? `${fullName(pending.user)} tendrá acceso completo al área de administración.`
              : `${fullName(pending.user)} perderá el acceso al área de administración.`
            : ""
        }
        confirmLabel={busy ? "Guardando…" : "Confirmar"}
        cancelLabel="Cancelar"
        tone={pending?.makeAdmin ? "default" : "danger"}
        onConfirm={confirmChange}
        onCancel={() => setPending(null)}
      />

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
