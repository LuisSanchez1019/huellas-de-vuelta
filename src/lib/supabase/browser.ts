import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Cliente de Supabase del navegador. En el navegador es UN SOLO cliente compartido:
 * crear uno por llamada abría varias instancias de GoTrueClient que refrescan el token
 * a la vez y podían dejar una petición (por ejemplo, la firma de una foto) sin sesión
 * válida. En el servidor (render de Next) se crea uno nuevo por llamada para no compartir
 * estado entre visitantes.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Falta configurar Supabase en .env.local.");
  }

  const client = createClient(url, publishableKey);
  if (typeof window !== "undefined") browserClient = client;
  return client;
}
