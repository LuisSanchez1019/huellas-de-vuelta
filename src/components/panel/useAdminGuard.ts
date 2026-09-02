"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveAdminSession } from "@/lib/auth/adminSession";
import type { PanelSession } from "@/lib/auth/session";

export type AdminGuardState =
  | { status: "checking" }
  | { status: "ready"; session: PanelSession };

/**
 * Guard del área /admin. Se ejecuta en el cliente para redirigir, pero NO es la
 * única barrera: Supabase (RLS + RPC `is_admin()`) rechaza toda lectura o acción
 * administrativa aunque alguien fuerce la ruta.
 *
 * - sin sesión               → /auth
 * - sesión sin is_admin=true  → /dashboard  (aunque escriba la URL a mano)
 * - admin real                → ready
 */
export function useAdminGuard(): AdminGuardState {
  const router = useRouter();
  const [state, setState] = useState<AdminGuardState>({ status: "checking" });

  useEffect(() => {
    let active = true;
    resolveAdminSession().then((check) => {
      if (!active) return;
      if (check.status === "unauthenticated") {
        router.replace("/auth");
        return;
      }
      if (check.status === "not-admin") {
        router.replace("/dashboard");
        return;
      }
      setState({ status: "ready", session: check.session });
    });
    return () => {
      active = false;
    };
  }, [router]);

  return state;
}
