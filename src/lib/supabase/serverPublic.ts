import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para lecturas PÚBLICAS desde el servidor (Server
 * Components/route handlers): misma clave publicable que usa el navegador
 * (mismo rol `anon`, mismo RLS — ningún privilegio adicional), pero sin
 * `localStorage` (no existe en el servidor) ni refresco de sesión, porque
 * estas lecturas nunca dependen de una sesión de usuario.
 */
export function createSupabasePublicServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Falta configurar Supabase en .env.local.");
  }

  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
