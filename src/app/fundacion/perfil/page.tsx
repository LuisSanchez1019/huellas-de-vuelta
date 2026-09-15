"use client";

import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import FoundationProfileForm from "@/components/fundacion/FoundationProfileForm";
import InlineRetry from "@/components/panel/InlineRetry";
import { ProfileSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";

export default function FundacionPerfilPage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    resolvePanelSession().then((check) => {
      if (!active) return;
      if (check.status === "error") {
        setHasError(true);
        return;
      }
      if (check.status !== "unauthenticated") setOwnerId(check.session.userId);
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Perfil de la fundación</h1>
        <p className={controls.pageSubtitle}>
          Información pública de tu fundación. La ubicación (latitud y longitud) se usará para mostrarla en
          el mapa de la página principal.
        </p>
      </div>
      {hasError ? (
        <InlineRetry
          onRetry={() => {
            setHasError(false);
            setAttempt((n) => n + 1);
          }}
        />
      ) : ownerId ? (
        <FoundationProfileForm ownerId={ownerId} />
      ) : (
        <ProfileSkeletonBody />
      )}
    </div>
  );
}
