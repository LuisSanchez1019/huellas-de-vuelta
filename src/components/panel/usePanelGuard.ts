"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolvePanelSession, type PanelSession } from "@/lib/auth/session";
import { roleHome, type AccountRole } from "@/lib/auth/roles";
import type { PanelUser } from "./types";

export type PanelGuardState =
  | { status: "checking" }
  | { status: "ready"; session: PanelSession; isDev: boolean }
  | { status: "error"; retry: () => void };

/**
 * Guard compartido por los layouts de panel. Un solo lugar con la lógica de:
 * sin sesión → /auth · rol distinto al permitido → panel de su rol · si coincide → ready.
 *
 * `resolvePanelSession` nunca queda colgada indefinidamente (tiene timeout
 * interno); si de verdad falla (red caída, Supabase sin responder), este
 * guard expone `status: "error"` con un `retry()` en vez de dejar el panel
 * mostrando "Verificando tu sesión…" para siempre.
 */
export function usePanelGuard(allowedRole: AccountRole): PanelGuardState {
  const router = useRouter();
  const [state, setState] = useState<PanelGuardState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    resolvePanelSession().then((check) => {
      if (!active) return;
      if (check.status === "error") {
        setState({
          status: "error",
          retry: () => {
            setState({ status: "checking" });
            setAttempt((n) => n + 1);
          },
        });
        return;
      }
      if (check.status === "unauthenticated") {
        router.replace("/auth");
        return;
      }
      if (check.session.role !== allowedRole) {
        router.replace(roleHome[check.session.role]);
        return;
      }
      setState({ status: "ready", session: check.session, isDev: check.isDev });
    });
    return () => {
      active = false;
    };
  }, [router, allowedRole, attempt]);

  return state;
}

export function toPanelUser(session: PanelSession): PanelUser {
  return {
    id: session.userId,
    email: session.email,
    displayName: session.displayName,
    role: session.role,
  };
}
