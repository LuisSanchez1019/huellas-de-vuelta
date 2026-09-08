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

  useEffect(() => {
    let active = true;
    (async () => {
      const check = await resolvePanelSession();
      if (check.status === "unauthenticated") {
        if (active) setState("no-session");
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
  }, []);

  if (state === "loading") return <p className={controls.loading}>Cargando tu panel…</p>;
  if (state === "no-session") {
    return <p className={controls.empty}>Inicia sesión con una cuenta real para ver tu panel.</p>;
  }
  if (state === "error") return <p className={controls.empty}>No fue posible cargar tu panel.</p>;

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={styles.greeting}>Hola{name ? `, ${name}` : ""}</h1>
        <p className={styles.greetingSub}>
          Este es el resumen de tus mascotas y tu actividad reciente.
        </p>
      </div>

      <div className={styles.grid}>
        <Link href="/dashboard/mascotas" className={styles.card}>
          <span className={styles.iconWrap}><PawIcon size={22} /></span>
          <span className={styles.cardBody}>
            <span className={styles.value}>{summary.petsTotal}</span>
            <span className={styles.label}>Mis mascotas</span>
          </span>
        </Link>

        <Link
          href="/dashboard/reportes/activos"
          className={`${styles.card} ${summary.petsLost > 0 ? styles.cardHighlight : ""}`}
        >
          <span className={styles.iconWrap}><AlertIcon size={22} /></span>
          <span className={styles.cardBody}>
            <span className={styles.value}>{summary.petsLost}</span>
            <span className={styles.label}>Mascotas perdidas</span>
          </span>
        </Link>

        <Link href="/dashboard/actividad" className={styles.card}>
          <span className={styles.iconWrap}><HeartIcon size={22} /></span>
          <span className={styles.cardBody}>
            <span className={styles.value}>{summary.petsAdoption}</span>
            <span className={styles.label}>En adopción</span>
          </span>
        </Link>

        <Link href="/dashboard/reportes/activos" className={styles.card}>
          <span className={styles.iconWrap}><ReportIcon size={22} /></span>
          <span className={styles.cardBody}>
            <span className={styles.value}>{summary.activeReports}</span>
            <span className={styles.label}>Reportes activos</span>
          </span>
        </Link>

        <Link
          href="/dashboard/notificaciones"
          className={`${styles.card} ${summary.unreadNotifications > 0 ? styles.cardHighlight : ""}`}
        >
          <span className={styles.iconWrap}><BellIcon size={22} /></span>
          <span className={styles.cardBody}>
            <span className={styles.value}>{summary.unreadNotifications}</span>
            <span className={styles.label}>Avisos sin leer</span>
          </span>
        </Link>

        <Link href="/dashboard/actividad" className={styles.card}>
          <span className={styles.iconWrap}><HandIcon size={22} /></span>
          <span className={styles.cardBody}>
            <span className={styles.value}>{summary.petsInOrg}</span>
            <span className={styles.label}>En veterinaria / fundación</span>
          </span>
        </Link>
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
          <Link href="/dashboard/mascotas/qr" className={`${styles.action} ${styles.actionSecondary}`}>
            <ReportIcon size={16} /> Ver placas QR
          </Link>
        </div>
      </div>
    </div>
  );
}
