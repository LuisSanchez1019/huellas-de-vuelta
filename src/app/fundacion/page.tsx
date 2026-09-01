"use client";

import { useOrgScope } from "@/components/panel/useOrgScope";
import OrgDashboardStats from "@/components/mascotas/OrgDashboardStats";
import controls from "@/components/ui/controls.module.css";

export default function FundacionHomePage() {
  const scope = useOrgScope("fundacion");

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Panel de la fundación</h1>
        <p className={controls.pageSubtitle}>
          Resumen de las mascotas a cargo de tu fundación. Carga masiva, búsqueda de hogar y padrinos
          desde el menú lateral.
        </p>
      </div>
      {scope ? <OrgDashboardStats scope={scope} role="fundacion" /> : <p className={controls.loading}>Cargando…</p>}
    </div>
  );
}
