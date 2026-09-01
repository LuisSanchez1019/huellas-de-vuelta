"use client";

import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import FoundationProfileForm from "@/components/fundacion/FoundationProfileForm";
import controls from "@/components/ui/controls.module.css";

export default function FundacionPerfilPage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    resolvePanelSession().then((check) => {
      if (check.status !== "unauthenticated") setOwnerId(check.session.userId);
    });
  }, []);

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Perfil de la fundación</h1>
        <p className={controls.pageSubtitle}>
          Información pública de tu fundación. La ubicación (latitud y longitud) se usará para mostrarla en
          el mapa de la página principal.
        </p>
      </div>
      {ownerId ? <FoundationProfileForm ownerId={ownerId} /> : <p className={controls.loading}>Cargando…</p>}
    </div>
  );
}
