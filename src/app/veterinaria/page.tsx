"use client";

import { useOrgScope } from "@/components/panel/useOrgScope";
import OrgDashboardStats from "@/components/mascotas/OrgDashboardStats";
import OrgStatusCard from "@/components/organizacion/OrgStatusCard";
import InlineRetry from "@/components/panel/InlineRetry";
import { DashboardSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";

export default function VeterinariaHomePage() {
  const scopeState = useOrgScope("veterinaria");

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Panel de la veterinaria</h1>
        <p className={controls.pageSubtitle}>
          Resumen de las mascotas registradas. Desde el menú puedes cargar mascotas por Excel y crear el
          perfil público de tu veterinaria.
        </p>
      </div>
      <OrgStatusCard role="veterinaria" />
      {scopeState.status === "ready" && <OrgDashboardStats scope={scopeState.scope} role="veterinaria" />}
      {scopeState.status === "loading" && <DashboardSkeletonBody />}
      {scopeState.status === "error" && <InlineRetry onRetry={scopeState.retry} />}
    </div>
  );
}
