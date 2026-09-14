"use client";

import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import AliadoProfileForm from "@/components/aliado/AliadoProfileForm";
import controls from "@/components/ui/controls.module.css";

export default function AliadoPerfilPage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    resolvePanelSession().then((check) => {
      if (check.status !== "unauthenticated") setOwnerId(check.session.userId);
    });
  }, []);

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Perfil de la empresa</h1>
        <p className={controls.pageSubtitle}>
          Información de tu empresa como aliada de Huellas de Vuelta: logo, nombre, país, ciudad y
          dirección.
        </p>
      </div>
      {ownerId ? <AliadoProfileForm ownerId={ownerId} /> : <p className={controls.loading}>Cargando…</p>}
    </div>
  );
}
