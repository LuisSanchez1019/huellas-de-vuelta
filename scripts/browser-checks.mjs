// Pruebas en un navegador REAL sin cabeza (Edge o Chrome ya instalados; sin dependencias nuevas):
//   1. Navbar responsive por rol (320/360/414/600/768/1024/1280): hamburguesa visible de 44 px,
//      sin solapes, nada fuera del viewport, la X queda por encima del drawer, Escape cierra.
//   2. Imágenes de mascotas: el HTML del servidor no trae URLs firmadas; la foto aparece SIN recargar
//      (escritorio y móvil); si la firma falla o vence se reintenta UNA vez; si vuelve a fallar queda
//      el marcador sin bucles.
//
// Requiere el servidor levantado:  npm run dev  (los paneles por rol usan el modo desarrollo)
//   BASE=http://localhost:3000 node scripts/browser-checks.mjs [navbar|images]
// El navegador se puede indicar con BROWSER=ruta-al-exe.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ONLY = process.argv[2] ?? "all";
const CANDIDATES = [
  process.env.BROWSER,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
if (!exe) { console.error("No se encontró Edge/Chrome. Indica BROWSER=ruta."); process.exit(2); }

const PORT = 9333 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "hdv-browser-"));
const proc = spawn(exe, [`--headless=new`, `--disable-gpu`, `--no-first-run`, `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0, failed = 0;
function check(name, ok, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; process.exitCode = 1; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`); }
}

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* aún arrancando */ }
    await sleep(250);
  }
  throw new Error("El navegador no arrancó");
}

const ws = new WebSocket(await connect());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 0;
const pending = new Map();
const listeners = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
  } else if (msg.method) {
    for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};
async function viewport(width, height = 800) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
}
async function goto(url) {
  await send("Page.navigate", { url });
  for (let i = 0; i < 80; i++) { if ((await evaluate("document.readyState")) === "complete") break; await sleep(150); }
}
async function waitFor(expression, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { try { if (await evaluate(expression)) return true; } catch { /* navegando */ } await sleep(200); }
  return false;
}

await send("Page.enable");
await send("Runtime.enable");

// ---------------------------------------------------------------------------
async function navbar() {
  console.log("== navbar responsive por rol ==");
  const roles = [["usuario", "/dashboard"], ["veterinaria", "/veterinaria"], ["fundacion", "/fundacion"], ["aliado", "/aliado"], ["proveedor", "/proveedor"]];
  const widths = [320, 360, 414, 600, 768, 1024, 1280];
  let scriptId = null;
  for (const [role, route] of roles) {
    if (scriptId) await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId });
    ({ identifier: scriptId } = await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem('hdv.dev.role','${role}')}catch(e){}` }));
    for (const width of widths) {
      await viewport(width);
      await goto(BASE + route);
      const ready = await waitFor(`!!document.querySelector('header [class*="brandName"]')`);
      if (!ready) { check(`${role} ${width}px: el panel carga`, false, "no apareció la cabecera (¿servidor en modo desarrollo?)"); continue; }
      await sleep(400);
      const m = await evaluate(`(() => {
        const h = document.querySelector('header'); const R = (e) => e.getBoundingClientRect(); const vw = innerWidth;
        const tog = h.querySelector('button[aria-label*="menú"]'); const name = h.querySelector('[class*="brandName"]');
        const act = [...h.children].find((c) => String(c.className).includes('actions'));
        const brand = R(h.querySelector('a[class*="brand"]')); const a = R(act); const tg = R(tog);
        const badge = h.querySelector('[class*="badge"]'); const bv = badge && getComputedStyle(badge).display !== 'none' ? R(badge) : null;
        const right = Math.max(brand.right, R(name).right, bv ? bv.right : 0);
        const outside = [...h.querySelectorAll('button, a')].filter((e) => { const b = R(e); return b.width > 0 && (b.right > vw + 0.5 || b.left < -0.5); }).length;
        return { toggleShown: getComputedStyle(tog).display !== 'none', tw: tg.width, th: tg.height, iconW: R(tog.querySelector('svg')).width,
                 overlap: right > a.left + 0.5 || (getComputedStyle(tog).display !== 'none' && tg.right > brand.left + 0.5), outside, docSW: document.documentElement.scrollWidth, vw };
      })()`);
      const tag = `${role} ${width}px`;
      check(`${tag}: sin solapes ni elementos fuera del viewport`, !m.overlap && m.outside === 0 && m.docSW <= m.vw, JSON.stringify(m));
      if (width <= 1024) {
        check(`${tag}: hamburguesa visible, ≥ 44 px y con icono`, m.toggleShown && m.tw >= 44 && m.th >= 44 && m.iconW >= 20, JSON.stringify(m));
        await evaluate(`document.querySelector('header button[aria-label*="menú"]').click()`);
        await sleep(450);
        const open = await evaluate(`(() => {
          const btn = document.querySelector('header button[aria-label*="menú"]'); const b = btn.getBoundingClientRect();
          const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); const sb = document.querySelector('#panel-sidebar').getBoundingClientRect();
          return { label: btn.getAttribute('aria-label'), xW: btn.querySelector('svg').getBoundingClientRect().width, onTop: top === btn || btn.contains(top), sidebarLeft: sb.left,
                   inert: document.querySelector('#panel-sidebar').inert, scrollLocked: getComputedStyle(document.body).overflow.startsWith('hidden') };
        })()`);
        check(`${tag}: con el menú abierto la X es visible y queda por encima del drawer`, open.label === "Cerrar menú" && open.xW >= 20 && open.onTop && open.sidebarLeft >= -0.5 && !open.inert, JSON.stringify(open));
        check(`${tag}: con el menú abierto el fondo no se desplaza`, open.scrollLocked, JSON.stringify(open));
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await sleep(350);
        const closed = await evaluate(`document.querySelector('header button[aria-label*="menú"]').getAttribute('aria-expanded')`);
        check(`${tag}: Escape cierra el menú`, closed === "false", `aria-expanded=${closed}`);
      } else {
        check(`${tag}: escritorio sin hamburguesa`, !m.toggleShown, JSON.stringify(m));
      }
    }
  }
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId });
}

// ---------------------------------------------------------------------------
async function images() {
  console.log("== imágenes de mascotas (firma en el navegador, sin recargar) ==");
  const html = await (await fetch(BASE + "/")).text();
  check("el HTML del servidor no trae URLs firmadas de Storage", !/storage\/v1\/object\/sign\//.test(html));

  const SIGNED_IMG = `[...document.querySelectorAll('img')].filter((i) => /object\\/sign\\/pet-photos/.test(i.src))`;
  for (const [label, width, height] of [["escritorio", 1280, 800], ["móvil", 390, 844]]) {
    await viewport(width, height);
    await goto(BASE + "/");
    const found = await waitFor(`${SIGNED_IMG}.length > 0`, 25000);
    check(`${label}: la foto aparece en la primera carga (sin F5)`, found);
    if (found) {
      await evaluate(`${SIGNED_IMG}.forEach((i) => i.scrollIntoView({ block: 'center' }))`);
      const loaded = await waitFor(`${SIGNED_IMG}.every((i) => i.complete && i.naturalWidth > 0 && getComputedStyle(i).opacity === '1')`, 15000);
      check(`${label}: la foto carga y se muestra`, loaded);
    }
  }

  // Firma vencida / fallo al cargar: la primera petición de imagen falla y se reintenta UNA vez.
  async function scenario(failCount) {
    const seen = [];
    let signCalls = 0;
    await send("Fetch.enable", { patterns: [{ urlPattern: "*/storage/v1/object/sign/pet-photos*", requestStage: "Request" }] });
    const handler = async (p) => {
      const isImage = p.resourceType === "Image";
      if (!isImage) { signCalls++; await send("Fetch.continueRequest", { requestId: p.requestId }); return; }
      seen.push(p.request.url);
      if (seen.length <= failCount) await send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 400, body: btoa('{"error":"InvalidJWT","message":"exp claim timestamp check failed"}') });
      else await send("Fetch.continueRequest", { requestId: p.requestId });
    };
    listeners.set("Fetch.requestPaused", [handler]);
    await viewport(1280, 800);
    await goto(BASE + "/");
    await waitFor(`${SIGNED_IMG}.length > 0`, 25000);
    await evaluate(`${SIGNED_IMG}.forEach((i) => i.scrollIntoView({ block: 'center' }))`);
    await sleep(failCount >= 2 ? 6000 : 4000);
    const state = await evaluate(`(() => { const imgs = ${SIGNED_IMG}; return { imgs: imgs.length, ok: imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0), fallbacks: document.querySelectorAll('[class*="petItemPhotoFallback"]').length, srcs: process_debug ? imgs.map((i) => [i.src.slice(-30), i.complete, i.naturalWidth, i.getBoundingClientRect().width]) : 0 }; })()`.replace('process_debug', String(!!process.env.DEBUG)));
    await send("Fetch.disable");
    listeners.delete("Fetch.requestPaused");
    return { seen: seen.length, signCalls, state, urls: process.env.DEBUG ? seen.map((u) => u.slice(-40)) : undefined };
  }
  const oneFail = await scenario(1);
  check("URL firmada vencida (400): se firma de nuevo y la foto termina cargando", oneFail.state.ok && oneFail.seen >= 2, JSON.stringify(oneFail));
  const allFail = await scenario(99);
  check("si vuelve a fallar: un solo reintento, sin bucles, y la foto rota se sustituye por el marcador", allFail.seen >= 2 && allFail.seen <= 4 && allFail.state.imgs === 0, JSON.stringify(allFail));
}

try {
  if (ONLY === "all" || ONLY === "navbar") await navbar();
  if (ONLY === "all" || ONLY === "images") await images();
} finally {
  console.log(`\n${passed} comprobaciones OK, ${failed} con fallas`);
  ws.close();
  proc.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* el navegador aún libera el perfil */ }
}
