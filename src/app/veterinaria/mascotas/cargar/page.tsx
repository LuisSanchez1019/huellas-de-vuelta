"use client";

import { useOrgScope } from "@/components/panel/useOrgScope";
import ExcelPetUploader from "@/components/mascotas/ExcelPetUploader";
import controls from "@/components/ui/controls.module.css";

export default function VeterinariaCargarPage() {
  const scope = useOrgScope("veterinaria");

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Cargar mascotas desde Excel</h1>
        <p className={controls.pageSubtitle}>
          Sube un archivo .xlsx con varias mascotas. Revisa la vista previa y confirma para agregarlas a
          tu lista.
        </p>
      </div>
      {scope ? (
        <ExcelPetUploader scope={scope} backHref="/veterinaria/mascotas" />
      ) : (
        <p className={controls.loading}>Cargando…</p>
      )}
    </div>
  );
}
