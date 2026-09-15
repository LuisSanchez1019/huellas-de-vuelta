"use client";

import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import VeterinaryProfileForm from "@/components/veterinaria/VeterinaryProfileForm";
import InlineRetry from "@/components/panel/InlineRetry";
import { ProfileSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";

export default function VeterinariaCrearPerfilPage() {
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
        <h1 className={controls.pageTitle}>Perfil de la veterinaria</h1>
        <p className={controls.pageSubtitle}>
          Esta información se usará para mostrar tu veterinaria en la página pública. Complétala y
          publícala cuando esté lista.
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
        <VeterinaryProfileForm ownerId={ownerId} />
      ) : (
        <ProfileSkeletonBody />
      )}
    </div>
  );
}
