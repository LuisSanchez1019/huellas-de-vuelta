"use client";

import { useOrgScope } from "@/components/panel/useOrgScope";
import OrgDashboardStats from "@/components/mascotas/OrgDashboardStats";
import OrgStatusCard from "@/components/organizacion/OrgStatusCard";
import controls from "@/components/ui/controls.module.css";

export default function VeterinariaHomePage() {
  const scope = useOrgScope("veterinaria");

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
      {scope ? <OrgDashboardStats scope={scope} role="veterinaria" /> : <p className={controls.loading}>Cargando…</p>}
    </div>
  );
}
