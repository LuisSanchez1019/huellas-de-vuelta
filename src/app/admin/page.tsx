"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { adminCounts, type AdminCounts } from "@/lib/supabase/adminUsers";
import { ActivityIcon, PawIcon, ReportIcon, UserIcon } from "@/components/icons/Icon";
import AdminStatCard from "@/components/admin/AdminStatCard";
import controls from "@/components/ui/controls.module.css";
import styles from "./admin.module.css";

export default function AdminHomePage() {
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    adminCounts(supabase)
      .then(setCounts)
      .catch(() => setError(true));
  }, []);

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
        <p className={controls.empty}>No fue posible cargar las estadísticas.</p>
      ) : (
        <div className={styles.statGrid}>
          <AdminStatCard icon={<UserIcon size={22} />} label="Usuarios registrados" value={counts?.users ?? "—"} />
          <AdminStatCard icon={<PawIcon size={20} />} label="Mascotas activas" value={counts?.pets ?? "—"} />
          <AdminStatCard icon={<ReportIcon size={20} />} label="Reportes de pérdida activos" value={counts?.activeReports ?? "—"} />
          <AdminStatCard icon={<ActivityIcon size={22} />} label="Organizaciones por revisar" value={counts?.pendingOrgs ?? "—"} />
        </div>
      )}
    </div>
  );
}
