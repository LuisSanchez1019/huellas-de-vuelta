"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { getPetPhotoUrl } from "@/lib/supabase/petPhotos";

type Resolved = { path: string; url: string | null; retried: boolean; loaded: boolean };

const RETRY_DELAY_MS = 800;

/**
 * Foto de una mascota del bucket privado. Recibe la RUTA (`path`), no una URL firmada: la
 * firma se pide en el navegador al mostrarla (ver `lib/supabase/petPhotos.ts`), así que
 * nunca llega una URL vencida por culpa de HTML cacheado.
 *
 * - Mientras se firma (o si no hay foto / no se pudo firmar) muestra `fallback`.
 * - Si la firma falla se reintenta UNA vez; si la imagen no carga (firma vencida o red) se
 *   vuelve a firmar UNA vez y, si aun así falla, queda el `fallback` (la próxima vez que se
 *   monte el componente se intenta de nuevo).
 * - `url` permite mostrar una imagen externa que no es de Storage (sin firma).
 */
export default function PetPhoto({
  path,
  url,
  alt,
  className,
  style,
  bucket,
  width,
  height,
  fallback,
}: {
  path: string | null | undefined;
  url?: string | null;
  alt: string;
  className?: string;
  style?: CSSProperties;
  /** Bucket privado de la imagen (por defecto `pet-photos`; posters: `org-posters`). */
  bucket?: string;
  width?: number;
  height?: number;
  fallback: ReactNode;
}) {
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    (async () => {
      let signed = await getPetPhotoUrl(path, { bucket });
      if (signed === null) {
        await new Promise((done) => setTimeout(done, RETRY_DELAY_MS));
        if (!alive) return;
        signed = await getPetPhotoUrl(path, { force: true, bucket });
      }
      if (alive) setResolved({ path, url: signed, retried: false, loaded: false });
    })();
    return () => {
      alive = false;
    };
  }, [path, bucket]);

  if (!path) {
    // eslint-disable-next-line @next/next/no-img-element -- imagen externa opcional (no es de Storage)
    return url ? <img src={url} alt={alt} className={className} style={style} loading="lazy" decoding="async" /> : <>{fallback}</>;
  }

  const current = resolved && resolved.path === path ? resolved : null;
  if (!current || !current.url) return <>{fallback}</>;

  async function onError() {
    if (!current || current.retried) {
      setResolved((value) => (value && value.path === path ? { ...value, url: null } : value));
      return;
    }
    const fresh = await getPetPhotoUrl(path as string, { force: true, bucket });
    setResolved((value) =>
      value && value.path === path ? { ...value, url: fresh, retried: true, loaded: false } : value,
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
    <img
      // El reintento siempre monta una <img> nueva: una firma repetida en el mismo segundo es idéntica.
      key={`${current.url}#${current.retried ? 1 : 0}`}
      src={current.url}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={onError}
      onLoad={() => setResolved((value) => (value && value.path === path ? { ...value, loaded: true } : value))}
      style={{ ...style, opacity: current.loaded ? 1 : 0, transition: "opacity .18s ease" }}
    />
  );
}
