"use client";

import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import type { OrgKind, OrgScope } from "@/lib/pets/bulkPets";

/**
 * Resuelve el `OrgScope` (organización dueña) de la sesión actual para las
 * páginas de fundación/veterinaria. El guard del layout ya garantizó el rol.
 */
export function useOrgScope(kind: OrgKind): OrgScope | null {
  const [scope, setScope] = useState<OrgScope | null>(null);

  useEffect(() => {
    let active = true;
    resolvePanelSession().then((check) => {
      if (!active || check.status === "unauthenticated") return;
      setScope({ kind, id: check.session.userId, name: check.session.displayName });
    });
    return () => {
      active = false;
    };
  }, [kind]);

  return scope;
}
