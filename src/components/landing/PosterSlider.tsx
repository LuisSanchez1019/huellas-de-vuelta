"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "@/components/icons/Icon";
import type { LandingPoster } from "@/lib/supabase/publicCache";
import styles from "./posters.module.css";

const AUTOPLAY_MS = 7000;

function PosterCard({ poster }: { poster: LandingPoster }) {
  const alt = poster.title ? `${poster.title} — ${poster.orgName}` : `Poster de ${poster.orgName}`;
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen firmada de Storage, proporcion fija 3:1 */}
      <img src={poster.imageUrl} alt={alt} className={styles.img} loading="lazy" width={1200} height={400} />
      {poster.title && (
        <div className={styles.caption}>
          <span className={styles.captionTitle}>{poster.title}</span>
          <span className={styles.captionOrg}>{poster.orgName}</span>
        </div>
      )}
    </>
  );

  if (poster.targetUrl) {
    return (
      <a
        className={`${styles.card} ${styles.cardLink}`}
        href={poster.targetUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        {inner}
      </a>
    );
  }
  return <div className={styles.card}>{inner}</div>;
}

/**
 * Slider de posters del Landing. 1 poster: estatico, sin controles. 2-4:
 * autoplay + anterior/siguiente + puntos + swipe tactil, con pausa al pasar el
 * puntero o el foco. Respeta `prefers-reduced-motion` (sin autoplay ni
 * transicion). Nunca hay mas de 4 (lo limita la RPC del servidor).
 */
export default function PosterSlider({ posters }: { posters: LandingPoster[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = posters.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (count <= 1 || paused || reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused, reduced]);

  // El índice se acota en el render (no en un efecto) por si `count` cambia.
  const active = count > 0 ? ((index % count) + count) % count : 0;

  const go = useCallback(
    (next: number) => setIndex((((next % count) + count) % count)),
    [count],
  );

  if (count === 0) return null;

  if (count === 1) {
    return (
      <div className={styles.viewport}>
        <PosterCard poster={posters[0]} />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className={styles.viewport}
        onTouchStart={(event) => {
          touchX.current = event.touches[0].clientX;
          setPaused(true);
        }}
        onTouchEnd={(event) => {
          if (touchX.current === null) return;
          const dx = event.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
          touchX.current = null;
          setPaused(false);
        }}
      >
        <div
          className={`${styles.track} ${reduced ? "" : styles.animated}`}
          style={{ transform: `translateX(-${active * 100}%)` }}
          role="list"
          aria-label="Posters de organizaciones aliadas"
        >
          {posters.map((poster) => (
            <div className={styles.slide} role="listitem" key={poster.id}>
              <PosterCard poster={poster} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navPrev}`}
          onClick={() => go(active - 1)}
          aria-label="Poster anterior"
        >
          <ChevronDownIcon size={18} />
        </button>
        <div className={styles.dots} role="tablist" aria-label="Ir a un poster">
          {posters.map((poster, i) => (
            <button
              key={poster.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Poster ${i + 1} de ${count}`}
              className={i === active ? styles.dotActive : styles.dot}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navNext}`}
          onClick={() => go(active + 1)}
          aria-label="Poster siguiente"
        >
          <ChevronDownIcon size={18} />
        </button>
      </div>
    </div>
  );
}
