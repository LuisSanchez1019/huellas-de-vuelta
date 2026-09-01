"use client";

import Link from "next/link";
import { useOrgScope } from "@/components/panel/useOrgScope";
import BulkPetTable from "@/components/mascotas/BulkPetTable";
import controls from "@/components/ui/controls.module.css";

export default function VeterinariaMascotasPage() {
  const scope = useOrgScope("veterinaria");

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Mascotas de la veterinaria</h1>
        <p className={controls.pageSubtitle}>Consulta, edita y elimina las mascotas registradas por tu veterinaria.</p>
      </div>
      <Link href="/veterinaria/mascotas/cargar" className={controls.button}>Cargar mascotas (Excel)</Link>
      {scope ? (
        <div style={{ marginTop: "1.25rem" }}>
          <BulkPetTable scope={scope} role="veterinaria" />
        </div>
      ) : (
        <p className={controls.loading} style={{ marginTop: "1.25rem" }}>Cargando…</p>
      )}
    </div>
  );
}
