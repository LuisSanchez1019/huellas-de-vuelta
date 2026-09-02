"use client";

import Link from "next/link";
import { useOrgScope } from "@/components/panel/useOrgScope";
import BulkPetTable from "@/components/mascotas/BulkPetTable";
import controls from "@/components/ui/controls.module.css";

export default function FundacionMascotasPage() {
  const scope = useOrgScope("fundacion");

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
      {scope ? (
        <div style={{ marginTop: "1.25rem" }}>
          <BulkPetTable scope={scope} role="fundacion" />
        </div>
      ) : (
        <p className={controls.loading} style={{ marginTop: "1.25rem" }}>Cargando…</p>
      )}
    </div>
  );
}
