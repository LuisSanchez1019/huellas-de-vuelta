import { createSupabaseBrowserClient } from "./browser";

/**
 * URLs firmadas de las fotos de mascotas (bucket privado `pet-photos`), SIEMPRE generadas
 * en el navegador y en el momento de mostrarlas.
 *
 * Por qué no se firman en el servidor: el HTML/RSC de las páginas públicas queda en la caché
 * de Next (prerender + ISR con "stale-while-revalidate"). Una URL firmada dura 1 h, pero ese
 * HTML puede servirse horas después → el primer visitante recibía imágenes con la firma
 * vencida y solo con F5 aparecían. Aquí el servidor solo entrega la RUTA de la foto (que no
 * caduca) y el navegador pide una firma fresca, en lote y con caché en memoria.
 *
 * También sirve a otros buckets privados de imágenes públicas (posters: `bucket`).
 *
 * Solo Supabase existente: `createSignedUrls` (una petición por bucket para todas las fotos
 * de la pantalla). Las políticas de Storage siguen decidiendo quién puede firmar qué: el
 * propietario sus fotos, y cualquiera solo las de mascotas perdidas / encontradas / en adopción.
 */

export const PET_PHOTO_BUCKET = "pet-photos";
const SIGN_SECONDS = 3600;
/** Se reutiliza una firma ya pedida durante 45 min de su hora de vida. */
export const REUSE_MS = 45 * 60 * 1000;

/** Lo mínimo que se necesita del cliente de Supabase (facilita probar sin red). */
export interface SignerClient {
  storage: {
    from(bucket: string): {
      createSignedUrls(
        paths: string[],
        expiresIn: number,
      ): PromiseLike<{
        data: Array<{ path: string | null; signedUrl: string; error: string | null }> | null;
        error: unknown;
      }>;
    };
  };
  auth: { onAuthStateChange(callback: (event: string) => void): unknown };
}

type Waiter = (url: string | null) => void;

export interface PetPhotoSigner {
  getUrl(path: string, options?: { force?: boolean; bucket?: string }): Promise<string | null>;
  forget(path: string | null | undefined, bucket?: string): void;
  clear(): void;
}

export function createPetPhotoSigner(
  getClient: () => SignerClient,
  now: () => number = Date.now,
  schedule: (run: () => void) => void = (run) => void setTimeout(run, 0),
): PetPhotoSigner {
  const cache = new Map<string, { url: string; at: number }>();
  /** Cola por bucket: ruta -> quienes esperan su firma. */
  let queue: Map<string, Map<string, Waiter[]>> | null = null;
  let authWatch = false;
  const key = (bucket: string, path: string) => `${bucket}:${path}`;

  /** Al iniciar o cerrar sesión cambia lo que se puede firmar: se descarta lo guardado. */
  function watchAuthOnce() {
    if (authWatch) return;
    authWatch = true;
    try {
      getClient().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") cache.clear();
      });
    } catch {
      authWatch = false;
    }
  }

  async function flush() {
    const batches = queue;
    queue = null;
    if (!batches) return;
    await Promise.all(
      [...batches].map(async ([bucket, batch]) => {
        const signed = new Map<string, string>();
        try {
          const { data, error } = await getClient().storage.from(bucket).createSignedUrls([...batch.keys()], SIGN_SECONDS);
          if (!error) {
            for (const entry of data ?? []) {
              if (entry.path && entry.signedUrl && !entry.error) signed.set(entry.path, entry.signedUrl);
            }
          }
        } catch {
          /* red caída o sesión sin resolver: se responde null y el llamador reintenta */
        }
        for (const [path, waiters] of batch) {
          const url = signed.get(path) ?? null;
          if (url) cache.set(key(bucket, path), { url, at: now() });
          for (const done of waiters) done(url);
        }
      }),
    );
  }

  return {
    /**
     * URL firmada vigente de una imagen, o `null` si no se pudo firmar (sin permiso, sin red…).
     * Las peticiones del mismo instante se agrupan en una sola llamada por bucket. `force`
     * ignora la copia en memoria (para reintentar cuando la imagen falló al cargar). Un fallo
     * NUNCA se guarda: la siguiente petición vuelve a intentarlo.
     */
    getUrl(path, options = {}) {
      const bucket = options.bucket ?? PET_PHOTO_BUCKET;
      watchAuthOnce();
      if (options.force) {
        cache.delete(key(bucket, path));
      } else {
        const hit = cache.get(key(bucket, path));
        if (hit && now() - hit.at < REUSE_MS) return Promise.resolve(hit.url);
      }
      return new Promise((resolve) => {
        if (!queue) {
          queue = new Map();
          schedule(() => void flush());
        }
        const batch = queue.get(bucket) ?? new Map<string, Waiter[]>();
        const waiters = batch.get(path) ?? [];
        waiters.push(resolve);
        batch.set(path, waiters);
        queue.set(bucket, batch);
      });
    },
    /** Olvida la firma de una ruta (por ejemplo, al reemplazar o borrar su foto). */
    forget(path, bucket = PET_PHOTO_BUCKET) {
      if (path) cache.delete(key(bucket, path));
    },
    clear() {
      cache.clear();
    },
  };
}

const browserSigner = createPetPhotoSigner(() => createSupabaseBrowserClient() as unknown as SignerClient);

export function getPetPhotoUrl(
  path: string,
  options: { force?: boolean; bucket?: string } = {},
): Promise<string | null> {
  return browserSigner.getUrl(path, options);
}

export function forgetPetPhoto(path: string | null | undefined, bucket: string = PET_PHOTO_BUCKET): void {
  browserSigner.forget(path, bucket);
}
