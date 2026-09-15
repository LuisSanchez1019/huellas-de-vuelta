"use client";

import { useOrgScope } from "@/components/panel/useOrgScope";
import ExcelPetUploader from "@/components/mascotas/ExcelPetUploader";
import InlineRetry from "@/components/panel/InlineRetry";
import { FormSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";

export default function FundacionCargarPage() {
  const scopeState = useOrgScope("fundacion");

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Cargar mascotas desde Excel</h1>
        <p className={controls.pageSubtitle}>
          Sube un archivo .xlsx con varias mascotas. Verás una vista previa y podrás confirmar antes de
          que se agreguen a tu lista.
        </p>
      </div>
      {scopeState.status === "ready" && (
        <ExcelPetUploader scope={scopeState.scope} backHref="/fundacion/mascotas" />
      )}
      {scopeState.status === "loading" && <FormSkeletonBody />}
      {scopeState.status === "error" && <InlineRetry onRetry={scopeState.retry} />}
    </div>
  );
}
