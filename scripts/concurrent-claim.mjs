// Prueba REAL de concurrencia del claim: dos sesiones distintas reclaman el MISMO QR disponible a la vez,
// cada una con una mascota propia. Se ejecuta en TU máquina: los tokens nunca pasan por el asistente.
//
// Uso (PowerShell), con dos cuentas de usuario REALES que ya tengan una mascota cada una:
//   $env:TOKEN_A = "<access_token de la cuenta A>"      # ver README abajo
//   $env:TOKEN_B = "<access_token de la cuenta B>"
//   node scripts/concurrent-claim.mjs list                       # muestra las mascotas de A y de B (id y nombre)
//   $env:PET_A = "<id>"; $env:PET_B = "<id>"; $env:QR = "<public_id del QR de prueba>"
//   node scripts/concurrent-claim.mjs race                       # ambas llamadas salen en el mismo instante
//
// Resultado esperado: EXACTAMENTE una respuesta 200 (short_code + status "active") y la otra 400 con
// "TAG_ALREADY_ACTIVE". Cualquier otro resultado (dos 200, o un error distinto) es un fallo.
//
// Cómo obtener un access_token sin escribir contraseñas en ningún sitio: inicia sesión en la app, abre las
// herramientas de desarrollador (F12) > Consola y ejecuta:
//   JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.includes("auth-token")))).access_token
// Los tokens caducan (~1 h) y este script no los imprime ni los guarda.
import { readFileSync } from "node:fs";

function envFromDotfile(name) {
  try {
    const line = readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).replace(/^"|"$/g, "").trim() : undefined;
  } catch { return undefined; }
}
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFromDotfile("NEXT_PUBLIC_SUPABASE_URL");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? envFromDotfile("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const { TOKEN_A, TOKEN_B, PET_A, PET_B, QR } = process.env;
const mode = process.argv[2];

const headers = (token) => ({ apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

if (!URL_BASE || !KEY) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local)."); process.exit(2); }
if (!TOKEN_A || !TOKEN_B) { console.error("Define TOKEN_A y TOKEN_B (ver instrucciones al inicio del archivo)."); process.exit(2); }

if (mode === "list") {
  for (const [label, token] of [["A", TOKEN_A], ["B", TOKEN_B]]) {
    const res = await fetch(`${URL_BASE}/rest/v1/pets?select=id,name,is_archived`, { headers: headers(token) });
    const body = await res.json();
    console.log(`Cuenta ${label} (HTTP ${res.status}):`);
    if (!Array.isArray(body)) { console.log("  ", body?.message ?? body); continue; }
    for (const pet of body) console.log(`   ${pet.id}  ${pet.name}${pet.is_archived ? " (archivada)" : ""}`);
  }
} else if (mode === "race") {
  if (!PET_A || !PET_B || !QR) { console.error("Define PET_A, PET_B y QR."); process.exit(2); }
  const call = (token, pet) =>
    fetch(`${URL_BASE}/rest/v1/rpc/qr_claim_tag`, { method: "POST", headers: headers(token), body: JSON.stringify({ p_public_id: QR, p_pet_id: pet }) })
      .then(async (res) => ({ status: res.status, at: Date.now(), body: await res.json().catch(() => null) }));
  // Las dos peticiones se lanzan en el mismo turno del bucle de eventos (sin esperar a la primera).
  const [a, b] = await Promise.all([call(TOKEN_A, PET_A), call(TOKEN_B, PET_B)]);
  for (const [label, r] of [["A", a], ["B", b]]) console.log(`Cuenta ${label}: HTTP ${r.status}`, JSON.stringify(r.body));
  const ok = [a, b].filter((r) => r.status === 200).length;
  const lost = [a, b].filter((r) => r.status !== 200 && /TAG_ALREADY_ACTIVE/.test(JSON.stringify(r.body))).length;
  console.log(ok === 1 && lost === 1 ? "\nRESULTADO: OK — un solo ganador y el otro recibió TAG_ALREADY_ACTIVE." : "\nRESULTADO: FALLO — revisa las respuestas de arriba.");
  process.exitCode = ok === 1 && lost === 1 ? 0 : 1;
} else {
  console.error("Modo: list | race");
  process.exit(2);
}
