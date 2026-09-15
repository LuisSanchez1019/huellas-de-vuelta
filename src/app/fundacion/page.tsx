"use client";

import { useOrgScope } from "@/components/panel/useOrgScope";
import OrgDashboardStats from "@/components/mascotas/OrgDashboardStats";
import OrgStatusCard from "@/components/organizacion/OrgStatusCard";
import InlineRetry from "@/components/panel/InlineRetry";
import { DashboardSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";

export default function FundacionHomePage() {
  const scopeState = useOrgScope("fundacion");

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Panel de la fundación</h1>
        <p className={controls.pageSubtitle}>
          Resumen de las mascotas a cargo de tu fundación. Carga masiva, búsqueda de hogar y padrinos
          desde el menú lateral.
        </p>
      </div>
      <OrgStatusCard role="fundacion" />
      {scopeState.status === "ready" && <OrgDashboardStats scope={scopeState.scope} role="fundacion" />}
      {scopeState.status === "loading" && <DashboardSkeletonBody />}
      {scopeState.status === "error" && <InlineRetry onRetry={scopeState.retry} />}
    </div>
  );
}
