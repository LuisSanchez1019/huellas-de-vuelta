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
        <h1 className={controls.pageTitle}>Mascotas de la fundación</h1>
        <p className={controls.pageSubtitle}>
          Consulta, edita y marca cada mascota como disponible para adopción o para recibir un padrino
          monetario.
        </p>
      </div>
      <Link href="/fundacion/mascotas/cargar" className={controls.button}>Cargar mascotas (Excel)</Link>
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
