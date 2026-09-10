"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons/Icon";
import styles from "./landing.module.css";

/**
 * Carrusel ligero y compartido por todas las secciones del Landing. Sin
 * librería: usa scroll nativo con `scroll-snap`, así el swipe táctil funciona
 * solo. Los botones y los puntos son opcionales — se ocultan si el contenido
 * cabe sin desbordar. Respeta `prefers-reduced-motion` (salto instantáneo en
 * vez de scroll animado).
 */
export default function CardSlider({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const isOverflow = max > 4;
    setOverflow(isOverflow);
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);
    const count = isOverflow ? Math.round(max / el.clientWidth) + 1 : 1;
    setPages(Math.max(1, count));
    setPage(Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth)));
  }, []);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const scrollByDir = useCallback((dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  }, []);

  const goToPage = useCallback((target: number) => {
    const el = trackRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }, []);

  return (
    <div className={styles.sliderWrap}>
      {overflow && (
        <button
          type="button"
          className={`${styles.sliderArrow} ${styles.sliderArrowPrev}`}
          onClick={() => scrollByDir(-1)}
          disabled={atStart}
          aria-label="Anterior"
        >
          <ChevronDownIcon size={20} />
        </button>
      )}

      <div className={styles.sliderTrack} ref={trackRef} role="list" aria-label={ariaLabel}>
        {children}
      </div>

      {overflow && (
        <button
          type="button"
          className={`${styles.sliderArrow} ${styles.sliderArrowNext}`}
          onClick={() => scrollByDir(1)}
          disabled={atEnd}
          aria-label="Siguiente"
        >
          <ChevronDownIcon size={20} />
        </button>
      )}

      {overflow && pages > 1 && (
        <div className={styles.sliderDots} role="tablist" aria-label={`Páginas de ${ariaLabel}`}>
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={`Página ${i + 1}`}
              className={i === page ? styles.sliderDotActive : styles.sliderDot}
              onClick={() => goToPage(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
