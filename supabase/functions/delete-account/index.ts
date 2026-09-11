// Huellas de Vuelta — Edge Function: eliminacion de cuenta del titular (Ley 1581/2012).
//
// Flujo seguro (nada de service_role en el navegador):
//   1. verify_jwt = true: Supabase valida el token antes de invocar.
//   2. Se identifica al usuario SOLO desde el token (nunca desde el body).
//   3. Reautenticacion: se exige la contrasena actual + escribir "ELIMINAR".
//   4. _account_deletion_prepare(uid): revalida bloqueos (ultimo admin, reportes
//      activos, pedidos en curso, cuenta de organizacion) y anonimiza bitacoras.
//   5. auth.admin.deleteUser(uid): borra el usuario de Auth -> libera el correo
//      (sin lista negra) y cascada a profiles y datos dependientes.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BLOCKER_MESSAGES: Record<string, string> = {
  LAST_ADMIN: "No puedes eliminar esta cuenta mientras seas el ultimo administrador activo.",
  ACTIVE_REPORTS: "Tienes reportes de mascota perdida activos. Cierralos antes de eliminar la cuenta.",
  OPEN_ORDERS: "Tienes pedidos de placa en curso. Espera a que se entreguen o cancelalos.",
  HAS_ORGANIZATION: "La eliminacion de cuentas de organizacion todavia no esta disponible.",
  PROFILE_NOT_FOUND: "No se encontro el perfil de la cuenta.",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  // Identidad SOLO desde el token.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "AUTH_REQUIRED" }, 401);
  const user = userData.user;
  const email = user.email;
  if (!email) return json({ error: "NO_EMAIL" }, 400);

  let body: { password?: string; confirm?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }
  if ((body.confirm ?? "").trim().toUpperCase() !== "ELIMINAR") {
    return json({ error: "CONFIRM_REQUIRED" }, 400);
  }
  if (!body.password || body.password.length < 1) {
    return json({ error: "PASSWORD_REQUIRED" }, 400);
  }

  // Reautenticacion: confirma que quien pide el borrado conoce la contrasena.
  const reauthClient = createClient(url, anonKey);
  const { error: reauthError } = await reauthClient.auth.signInWithPassword({
    email,
    password: body.password,
  });
  if (reauthError) return json({ error: "BAD_PASSWORD" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Revalida bloqueos + anonimiza bitacoras (server-side, nunca se confia en el cliente).
  const { error: prepError } = await admin.rpc("_account_deletion_prepare", { p_uid: user.id });
  if (prepError) {
    const code = (prepError.message || "").trim();
    return json({ error: code, message: BLOCKER_MESSAGES[code] ?? code }, 409);
  }

  const { error: delError } = await admin.auth.admin.deleteUser(user.id);
  if (delError) return json({ error: "DELETE_FAILED", message: delError.message }, 500);

  return json({ ok: true });
});
