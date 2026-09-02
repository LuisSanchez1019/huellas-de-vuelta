"use client";

import { useEffect, useState } from "react";
import { resolveAdminSession } from "@/lib/auth/adminSession";

/**
 * ¿La sesión actual es de un administrador real?
 * Se apoya en `resolveAdminSession` (sesión real + RPC `is_admin()`); nunca
 * devuelve `true` por el bypass de desarrollo ni por email.
 * Sirve solo para decidir si se muestra la sección "Administración" en el menú:
 * la protección real de /admin y de las acciones está en Supabase.
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    resolveAdminSession().then((check) => {
      if (active) setIsAdmin(check.status === "authorized");
    });
    return () => {
      active = false;
    };
  }, []);

  return isAdmin;
}
