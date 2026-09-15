"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { adminCounts, type AdminCounts } from "@/lib/supabase/adminUsers";
import { ActivityIcon, PawIcon, ReportIcon, UserIcon } from "@/components/icons/Icon";
import StatCard from "@/components/ui/StatCard";
import InlineRetry from "@/components/panel/InlineRetry";
import controls from "@/components/ui/controls.module.css";
import styles from "@/app/admin/admin.module.css";

/**
 * Estadísticas administrativas (RPC `admin_counts`, protegida por `is_admin()`
 * en el servidor — este componente no decide autorización, solo la muestra).
 */
export default function AdminHome() {
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    adminCounts(supabase)
      .then((next) => {
        if (active) setCounts(next);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Administración</h1>
        <p className={controls.pageSubtitle}>
          Resumen general de la plataforma. Revisa y aprueba las organizaciones aliadas desde la
          sección «Organizaciones».
        </p>
      </div>

      {error ? (
        <InlineRetry
          message="No fue posible cargar las estadísticas."
          onRetry={() => {
            setError(false);
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <div className={styles.statGrid}>
          <StatCard icon={<UserIcon size={22} />} label="Usuarios registrados" value={counts?.users ?? "—"} />
          <StatCard icon={<PawIcon size={20} />} label="Mascotas activas" value={counts?.pets ?? "—"} />
          <StatCard icon={<ReportIcon size={20} />} label="Reportes de pérdida activos" value={counts?.activeReports ?? "—"} />
          <StatCard icon={<ActivityIcon size={22} />} label="Organizaciones por revisar" value={counts?.pendingOrgs ?? "—"} />
        </div>
      )}
    </div>
  );
}
