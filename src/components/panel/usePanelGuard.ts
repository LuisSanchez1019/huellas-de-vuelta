"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolvePanelSession, type PanelSession } from "@/lib/auth/session";
import { roleHome, type AccountRole } from "@/lib/auth/roles";
import type { PanelUser } from "./types";

export type PanelGuardState =
  | { status: "checking" }
  | { status: "ready"; session: PanelSession; isDev: boolean };

/**
 * Guard compartido por los layouts de panel. Un solo lugar con la lógica de:
 * sin sesión → /auth · rol distinto al permitido → panel de su rol · si coincide → ready.
 */
export function usePanelGuard(allowedRole: AccountRole): PanelGuardState {
  const router = useRouter();
  const [state, setState] = useState<PanelGuardState>({ status: "checking" });

  useEffect(() => {
    let active = true;
    resolvePanelSession().then((check) => {
      if (!active) return;
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
  }, [router, allowedRole]);

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
