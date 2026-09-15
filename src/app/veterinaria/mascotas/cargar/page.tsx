"use client";

import { useOrgScope } from "@/components/panel/useOrgScope";
import ExcelPetUploader from "@/components/mascotas/ExcelPetUploader";
import InlineRetry from "@/components/panel/InlineRetry";
import { FormSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";

export default function VeterinariaCargarPage() {
  const scopeState = useOrgScope("veterinaria");

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Cargar mascotas desde Excel</h1>
        <p className={controls.pageSubtitle}>
          Sube un archivo .xlsx con varias mascotas. Revisa la vista previa y confirma para agregarlas a
          tu lista.
        </p>
      </div>
      {scopeState.status === "ready" && (
        <ExcelPetUploader scope={scopeState.scope} backHref="/veterinaria/mascotas" />
      )}
      {scopeState.status === "loading" && <FormSkeletonBody />}
      {scopeState.status === "error" && <InlineRetry onRetry={scopeState.retry} />}
    </div>
  );
}
