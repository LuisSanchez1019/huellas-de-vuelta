"use client";

import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import ProveedorProfileForm from "@/components/proveedores/ProveedorProfileForm";
import InlineRetry from "@/components/panel/InlineRetry";
import { ProfileSkeletonBody } from "@/components/loading/SkeletonVariants";
import controls from "@/components/ui/controls.module.css";

export default function ProveedorPerfilPage() {
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
        <h1 className={controls.pageTitle}>Perfil de la empresa</h1>
        <p className={controls.pageSubtitle}>
          Identidad y contacto comercial de tu empresa proveedora, separados de los datos personales de
          tu cuenta.
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
        <ProveedorProfileForm ownerId={ownerId} />
      ) : (
        <ProfileSkeletonBody />
      )}
    </div>
  );
}
