// Pruebas del firmador de fotos privadas (sin red): nunca se sirve una URL firmada guardada
// en HTML; se firma en el navegador, en lote, con caché por tiempo, sin cachear fallos.
//   node --experimental-transform-types --import ./scripts/register-ts.mjs scripts/pet-photos.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REUSE_MS, createPetPhotoSigner } from "@/lib/supabase/petPhotos";

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (e) { console.error(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
}
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

/** Cliente falso: cuenta llamadas y firma con un contador (cada firma es distinta). */
function fakeClient({ failFor = new Set(), throwAll = false } = {}) {
  const calls = [];
  const authCallbacks = [];
  let n = 0;
  return {
    calls,
    authCallbacks,
    client: {
      storage: {
        from: (bucket) => ({
          createSignedUrls: async (paths, expiresIn) => {
            calls.push({ bucket, paths: [...paths], expiresIn });
            if (throwAll) throw new Error("red caida");
            return {
              error: null,
              data: paths.map((path) => failFor.has(path)
                ? { path, signedUrl: "", error: "Object not found" }
                : { path, signedUrl: `https://x.supabase.co/sign/${bucket}/${path}?token=t${++n}`, error: null }),
            };
          },
        }),
      },
      auth: { onAuthStateChange: (cb) => { authCallbacks.push(cb); return {}; } },
    },
  };
}
/** Reloj y planificador manuales: `flushNow()` ejecuta el lote pendiente. */
function harness(opts) {
  const f = fakeClient(opts);
  let clock = 1_000_000;
  let pending = null;
  const signer = createPetPhotoSigner(() => f.client, () => clock, (run) => { pending = run; });
  return {
    ...f, signer,
    tick: (ms) => { clock += ms; },
    flushNow: async () => { const run = pending; pending = null; run?.(); await new Promise((r) => setTimeout(r, 0)); },
  };
}

console.log("== firmador de fotos privadas ==");

await test("varias mascotas en la misma pantalla: UNA sola llamada de firma", async () => {
  const h = harness();
  const ps = ["u/a.webp", "u/b.webp", "u/c.webp"].map((p) => h.signer.getUrl(p));
  await h.flushNow();
  const urls = await Promise.all(ps);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].paths, ["u/a.webp", "u/b.webp", "u/c.webp"]);
  assert.equal(h.calls[0].expiresIn, 3600);
  assert.ok(urls.every((u) => typeof u === "string" && u.includes("token=")));
});
await test("la misma ruta pedida dos veces a la vez se firma una vez", async () => {
  const h = harness();
  const [a, b] = [h.signer.getUrl("u/a.webp"), h.signer.getUrl("u/a.webp")];
  await h.flushNow();
  assert.equal(await a, await b);
  assert.deepEqual(h.calls[0].paths, ["u/a.webp"]);
});
await test("buckets distintos van en llamadas distintas (fotos y posters)", async () => {
  const h = harness();
  const ps = [h.signer.getUrl("u/a.webp"), h.signer.getUrl("p/1.webp", { bucket: "org-posters" })];
  await h.flushNow();
  await Promise.all(ps);
  assert.deepEqual(h.calls.map((c) => c.bucket).sort(), ["org-posters", "pet-photos"]);
});
await test("segunda visita dentro de la ventana: usa la copia en memoria (sin red)", async () => {
  const h = harness();
  const first = h.signer.getUrl("u/a.webp"); await h.flushNow(); const url1 = await first;
  h.tick(REUSE_MS - 1000);
  assert.equal(await h.signer.getUrl("u/a.webp"), url1);
  assert.equal(h.calls.length, 1);
});
await test("firma vieja (más de 45 min): se pide una nueva, nunca se reutiliza una a punto de vencer", async () => {
  const h = harness();
  const first = h.signer.getUrl("u/a.webp"); await h.flushNow(); const url1 = await first;
  h.tick(REUSE_MS + 1000);
  const second = h.signer.getUrl("u/a.webp"); await h.flushNow(); const url2 = await second;
  assert.equal(h.calls.length, 2);
  assert.notEqual(url1, url2);
});
await test("reintento con force (imagen que falló al cargar): firma nueva aunque haya copia", async () => {
  const h = harness();
  const first = h.signer.getUrl("u/a.webp"); await h.flushNow(); const url1 = await first;
  const retry = h.signer.getUrl("u/a.webp", { force: true }); await h.flushNow(); const url2 = await retry;
  assert.equal(h.calls.length, 2);
  assert.notEqual(url1, url2);
});
await test("un fallo NO se guarda: la siguiente petición vuelve a intentarlo (no queda el marcador para siempre)", async () => {
  const h = harness({ failFor: new Set(["u/rota.webp"]) });
  const a = h.signer.getUrl("u/rota.webp"); await h.flushNow();
  assert.equal(await a, null);
  const b = h.signer.getUrl("u/rota.webp"); await h.flushNow();
  assert.equal(await b, null);
  assert.equal(h.calls.length, 2);
});
await test("una foto que falla no arrastra a las demás del mismo lote", async () => {
  const h = harness({ failFor: new Set(["u/rota.webp"]) });
  const ps = [h.signer.getUrl("u/ok1.webp"), h.signer.getUrl("u/rota.webp"), h.signer.getUrl("u/ok2.webp")];
  await h.flushNow();
  const [a, b, c] = await Promise.all(ps);
  assert.ok(a && c);
  assert.equal(b, null);
});
await test("red caída: responde null (no lanza) y se puede reintentar", async () => {
  const h = harness({ throwAll: true });
  const a = h.signer.getUrl("u/a.webp"); await h.flushNow();
  assert.equal(await a, null);
});
await test("foto reemplazada: forget() descarta la firma de la ruta anterior; la nueva ruta se firma aparte", async () => {
  const h = harness();
  const first = h.signer.getUrl("u/p/viejo.webp"); await h.flushNow(); await first;
  h.signer.forget("u/p/viejo.webp");
  const again = h.signer.getUrl("u/p/viejo.webp"); await h.flushNow(); await again;
  const fresh = h.signer.getUrl("u/p/nuevo.webp"); await h.flushNow(); const url = await fresh;
  assert.equal(h.calls.length, 3);
  assert.match(url, /nuevo\.webp/);
});
await test("cerrar/iniciar sesión descarta lo guardado (lo firmable cambia con la sesión)", async () => {
  const h = harness();
  const a = h.signer.getUrl("u/a.webp"); await h.flushNow(); await a;
  assert.equal(h.authCallbacks.length, 1);
  h.authCallbacks[0]("SIGNED_OUT");
  const b = h.signer.getUrl("u/a.webp"); await h.flushNow(); await b;
  assert.equal(h.calls.length, 2);
  h.authCallbacks[0]("TOKEN_REFRESHED"); // no descarta
  const c = await h.signer.getUrl("u/a.webp");
  assert.equal(typeof c, "string");
  assert.equal(h.calls.length, 2);
});

console.log("== el servidor ya no incrusta URLs firmadas en HTML cacheado ==");
await test("publicCache.ts no firma fotos ni posters (solo entrega rutas)", () => {
  const src = read("src/lib/supabase/publicCache.ts");
  assert.doesNotMatch(src, /createSignedUrl|signPetPhotoUrls|getPosterSignedUrls/);
  assert.match(src, /photoPath/);
  assert.match(src, /imagePath/);
});
await test("no queda ningún componente que firme fotos de mascotas en el servidor", () => {
  for (const f of ["src/lib/supabase/orgPetsPublic.ts", "src/lib/supabase/pets.ts"]) {
    assert.doesNotMatch(read(f), /getPetPhotoSignedUrl/, f);
  }
});
await test("las tarjetas y listados usan PetPhoto (firma en el navegador, con reintento)", () => {
  for (const f of ["src/components/landing/PetCard.tsx", "src/components/landing/AdoptionCard.tsx", "src/components/mascotas/MyPetsList.tsx",
    "src/components/landing/PosterSlider.tsx", "src/components/mascota/PublicPetView.tsx"]) {
    assert.match(read(f), /PetPhoto/, f);
  }
});
await test("reemplazar una foto usa una ruta nueva (ya no se sobrescribe el mismo objeto)", () => {
  assert.match(read("src/lib/supabase/pets.ts"), /crypto\.randomUUID\(\)/);
  assert.match(read("src/lib/pets/bulkPetRepository.ts"), /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(read("src/lib/supabase/pets.ts"), /\$\{ownerId\}\/\$\{petId\}\.\$\{extension\}/);
});

console.log(`\n${passed} pruebas OK${process.exitCode ? " (HAY FALLAS)" : ""}`);
