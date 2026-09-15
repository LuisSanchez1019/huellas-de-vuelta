"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { resolvePanelSession } from "@/lib/auth/session";
import { fetchPets } from "@/lib/supabase/pets";
import { fetchMyReports } from "@/lib/supabase/reports";
import { countUnreadNotifications } from "@/lib/supabase/notifications";
import { fetchReceivedPetEvents } from "@/lib/supabase/reportEvents";
import { AlertIcon, BellIcon, HandIcon, HeartIcon, PawIcon, ReportIcon } from "@/components/icons/Icon";
import RouteLoading from "@/components/loading/RouteLoading";
import InlineRetry from "@/components/panel/InlineRetry";
import StatCard from "@/components/ui/StatCard";
import controls from "@/components/ui/controls.module.css";
import styles from "./dashboardHome.module.css";

interface Summary {
  petsTotal: number;
  petsLost: number;
  petsAdoption: number;
  activeReports: number;
  unreadNotifications: number;
  petsInOrg: number;
}

const EMPTY: Summary = {
  petsTotal: 0,
  petsLost: 0,
  petsAdoption: 0,
  activeReports: 0,
  unreadNotifications: 0,
  petsInOrg: 0,
};

/**
 * Inicio del panel del usuario: SOLO un resumen con datos reales de Supabase
 * y enlaces a los módulos. No duplica la lógica de mascotas/reportes/
 * notificaciones/actividad — reutiliza sus mismas funciones de datos.
 */
export default function DashboardHome() {
  const [state, setState] = useState<"loading" | "ready" | "no-session" | "error">("loading");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const check = await resolvePanelSession();
      if (!active) return;
      if (check.status === "error") {
        setState("error");
        return;
      }
      if (check.status === "unauthenticated") {
        setState("no-session");
        return;
      }
      setName(check.session.displayName.split(" ")[0] || "");
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (active) setState("no-session");
        return;
      }
      try {
        const [pets, reports, unread, received] = await Promise.all([
          fetchPets(supabase),
          fetchMyReports(supabase, "active"),
          countUnreadNotifications(supabase),
          fetchReceivedPetEvents(supabase),
        ]);
        if (!active) return;
        const inOrg = new Set(received.map((ev) => ev.pet_id));
        setSummary({
          petsTotal: pets.length,
          petsLost: pets.filter((p) => p.status === "lost").length,
          petsAdoption: pets.filter((p) => p.status === "for_adoption").length,
          activeReports: reports.length,
          unreadNotifications: unread,
          petsInOrg: inOrg.size,
        });
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  if (state === "loading") return <RouteLoading variant="dashboard" />;
  if (state === "no-session") {
    return <p className={controls.empty}>Inicia sesión con una cuenta real para ver tu panel.</p>;
  }
  if (state === "error") {
    return (
      <InlineRetry
        message="No fue posible cargar tu panel."
        onRetry={() => {
          setState("loading");
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={styles.greeting}>Hola{name ? `, ${name}` : ""}</h1>
        <p className={styles.greetingSub}>
          Este es el resumen de tus mascotas y tus reportes.
        </p>
      </div>

      <div className={styles.grid}>
        <StatCard href="/dashboard/mascotas" icon={<PawIcon size={22} />} label="Mis mascotas" value={summary.petsTotal} />
        <StatCard
          href="/dashboard/reportes/activos"
          icon={<AlertIcon size={22} />}
          label="Mascotas perdidas"
          value={summary.petsLost}
          highlight={summary.petsLost > 0}
        />
        <StatCard href="/dashboard/mascotas" icon={<HeartIcon size={22} />} label="En adopción" value={summary.petsAdoption} />
        <StatCard href="/dashboard/reportes/activos" icon={<ReportIcon size={22} />} label="Reportes activos" value={summary.activeReports} />
        <StatCard
          href="/dashboard/notificaciones"
          icon={<BellIcon size={22} />}
          label="Avisos sin leer"
          value={summary.unreadNotifications}
          highlight={summary.unreadNotifications > 0}
        />
        <StatCard href="/dashboard/mascotas" icon={<HandIcon size={22} />} label="En veterinaria / fundación" value={summary.petsInOrg} />
      </div>

      <div className={styles.actions}>
        <p className={styles.actionsTitle}>Acciones rápidas</p>
        <div className={styles.actionRow}>
          <Link href="/dashboard/mascotas/nueva" className={`${styles.action} ${styles.actionPrimary}`}>
            <PawIcon size={16} /> Registrar mascota
          </Link>
          <Link href="/dashboard/mascotas" className={`${styles.action} ${styles.actionSecondary}`}>
            <AlertIcon size={16} /> Reportar una pérdida
          </Link>
          <Link href="/dashboard/mascotas/solicitar-placa" className={`${styles.action} ${styles.actionSecondary}`}>
            <ReportIcon size={16} /> Solicitar placa
          </Link>
        </div>
      </div>
    </div>
  );
}
