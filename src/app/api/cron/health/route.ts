import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabasePublicServerClient } from "@/lib/supabase/serverPublic";

/**
 * Vercel Cron lo invoca una vez al día (ver vercel.json). Hace UNA consulta real
 * y mínima a Supabase (RPC `health_check()`) para mantener actividad periódica y
 * comprobar que responde. No garantiza que el proyecto nunca se pause.
 *
 * Cada ejecución debe llegar a Supabase: la ruta es siempre dinámica y nunca se
 * sirve una respuesta guardada.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const RPC_TIMEOUT_MS = 8_000;

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Comparación en tiempo constante (los hashes tienen siempre la misma longitud). */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/health] CRON_SECRET no está configurado; se rechaza la petición.");
    return false;
  }
  const match = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return false;
  return timingSafeEqual(sha256(match[1]), sha256(secret));
}

function unavailable() {
  return NextResponse.json({ ok: false }, { status: 503, headers: NO_STORE });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  try {
    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase
      .rpc("health_check")
      .abortSignal(AbortSignal.timeout(RPC_TIMEOUT_MS));

    if (error || typeof data !== "string") {
      console.error("[cron/health] health_check() no respondió correctamente.", {
        code: error?.code ?? null,
        message: error?.message ?? "respuesta inesperada",
      });
      return unavailable();
    }

    return NextResponse.json({ ok: true, serverTime: data }, { headers: NO_STORE });
  } catch (err) {
    console.error("[cron/health] fallo al llamar a Supabase.", {
      name: err instanceof Error ? err.name : "desconocido",
    });
    return unavailable();
  }
}
