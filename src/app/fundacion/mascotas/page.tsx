"use client";

import Link from "next/link";
import { useOrgScope } from "@/components/panel/useOrgScope";
import BulkPetTable from "@/components/mascotas/BulkPetTable";
import InlineRetry from "@/components/panel/InlineRetry";
import { TableSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";

export default function FundacionMascotasPage() {
  const scopeState = useOrgScope("fundacion");

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Mascotas / Listados</h1>
        <p className={controls.pageSubtitle}>
          Agrega mascotas una por una o impórtalas desde Excel, y marca cada una como disponible para
          adopción o para recibir un padrino. Cada mascota queda relacionada con tu fundación; otras
          organizaciones no pueden verlas ni editarlas.
        </p>
      </div>
      <Link href="/fundacion/mascotas/cargar" className={controls.buttonSecondary}>Cargar mascotas (Excel)</Link>
      {scopeState.status === "ready" && (
        <div style={{ marginTop: "1.25rem" }}>
          <BulkPetTable scope={scopeState.scope} role="fundacion" />
        </div>
      )}
      {scopeState.status === "loading" && (
        <div style={{ marginTop: "1.25rem" }}><TableSkeletonBody /></div>
      )}
      {scopeState.status === "error" && (
        <div style={{ marginTop: "1.25rem" }}><InlineRetry onRetry={scopeState.retry} /></div>
      )}
    </div>
  );
}
