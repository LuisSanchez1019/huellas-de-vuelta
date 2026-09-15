"use client";

import { useEffect, useState } from "react";
import { resolvePanelSession } from "@/lib/auth/session";
import type { OrgKind, OrgScope } from "@/lib/pets/bulkPets";

export type OrgScopeState =
  | { status: "loading"; scope: null }
  | { status: "ready"; scope: OrgScope }
  | { status: "error"; scope: null; retry: () => void };

/**
 * Resuelve el `OrgScope` (organización dueña) de la sesión actual para las
 * páginas de fundación/veterinaria. El guard del layout ya garantizó el rol.
 *
 * `resolvePanelSession` nunca queda colgada (tiene timeout interno); si de
 * verdad falla, se expone `status: "error"` con `retry()` en vez de dejar la
 * pantalla mostrando su skeleton para siempre.
 */
export function useOrgScope(kind: OrgKind): OrgScopeState {
  const [state, setState] = useState<OrgScopeState>({ status: "loading", scope: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    resolvePanelSession().then((check) => {
      if (!active) return;
      if (check.status === "error") {
        setState({
          status: "error",
          scope: null,
          retry: () => {
            setState({ status: "loading", scope: null });
            setAttempt((n) => n + 1);
          },
        });
        return;
      }
      if (check.status === "unauthenticated") return;
      setState({
        status: "ready",
        scope: { kind, id: check.session.userId, name: check.session.displayName },
      });
    });
    return () => {
      active = false;
    };
  }, [kind, attempt]);

  return state;
}
