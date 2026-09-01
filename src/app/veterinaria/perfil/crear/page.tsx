"use client";

import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import VeterinaryProfileForm from "@/components/veterinaria/VeterinaryProfileForm";
import controls from "@/components/ui/controls.module.css";

export default function VeterinariaCrearPerfilPage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    resolvePanelSession().then((check) => {
      if (check.status !== "unauthenticated") setOwnerId(check.session.userId);
    });
  }, []);

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Perfil de la veterinaria</h1>
        <p className={controls.pageSubtitle}>
          Esta información se usará para mostrar tu veterinaria en la página pública. Complétala y
          publícala cuando esté lista.
        </p>
      </div>
      {ownerId ? <VeterinaryProfileForm ownerId={ownerId} /> : <p className={controls.loading}>Cargando…</p>}
    </div>
  );
}
