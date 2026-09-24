"use client";

import IdentifyPanel from "@/components/vet/IdentifyPanel";
import MyGrantsList from "@/components/vet/MyGrantsList";
import controls from "@/components/ui/controls.module.css";

export default function ConsultarMascotaPage() {
  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Consultar mascota</h1>
        <p className={controls.pageSubtitle}>
          Identifica una mascota con su placa (QR o código de barras) o escribiendo su código. Para ver o registrar
          información clínica necesitas la autorización temporal del propietario.
        </p>
      </div>
      <IdentifyPanel />
      <MyGrantsList />
    </div>
  );
}
