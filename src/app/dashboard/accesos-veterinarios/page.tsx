"use client";

import OwnerVetAccess from "@/components/vet/OwnerVetAccess";
import controls from "@/components/ui/controls.module.css";

export default function AccesosVeterinariosPage() {
  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Accesos veterinarios</h1>
        <p className={controls.pageSubtitle}>
          Tú decides qué veterinaria puede ver o registrar información en la ficha médica de tu mascota, por cuánto
          tiempo y con qué permisos. Puedes revocar el acceso en cualquier momento.
        </p>
      </div>
      <OwnerVetAccess />
    </div>
  );
}
