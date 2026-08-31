"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./landing.module.css";

const AUTO_SCROLL_INTERVAL_MS = 3500;
const OVERFLOW_TOLERANCE_PX = 24;

export default function HorizontalScroller({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);

  function scroll(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * 300, behavior: "smooth" });
  }

  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let restartTimeoutId: ReturnType<typeof setTimeout> | null = null;

    function hasOverflow() {
      return track !== null && track.scrollWidth - track.clientWidth > OVERFLOW_TOLERANCE_PX;
    }

    function stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function tick() {
      if (!track || isPausedRef.current) return;
      const maxScroll = track.scrollWidth - track.clientWidth;
      const atEnd = track.scrollLeft >= maxScroll - OVERFLOW_TOLERANCE_PX;
      if (atEnd) {
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        track.scrollBy({ left: track.clientWidth * 0.85, behavior: "smooth" });
      }
    }

    function start() {
      stop();
      if (hasOverflow()) {
        intervalId = setInterval(tick, AUTO_SCROLL_INTERVAL_MS);
      }
    }

    function pause() {
      isPausedRef.current = true;
    }

    function resume() {
      isPausedRef.current = false;
    }

    function handleResize() {
      start();
    }

    start();
    // Layout can settle slightly after mount (fonts, hydration); recheck once.
    restartTimeoutId = setTimeout(start, 300);

    window.addEventListener("resize", handleResize);
    wrap.addEventListener("mouseenter", pause);
    wrap.addEventListener("mouseleave", resume);
    wrap.addEventListener("touchstart", pause, { passive: true });
    wrap.addEventListener("touchend", resume);
    wrap.addEventListener("focusin", pause);
    wrap.addEventListener("focusout", resume);

    return () => {
      stop();
      if (restartTimeoutId) clearTimeout(restartTimeoutId);
      window.removeEventListener("resize", handleResize);
      wrap.removeEventListener("mouseenter", pause);
      wrap.removeEventListener("mouseleave", resume);
      wrap.removeEventListener("touchstart", pause);
      wrap.removeEventListener("touchend", resume);
      wrap.removeEventListener("focusin", pause);
      wrap.removeEventListener("focusout", resume);
    };
  }, []);

  return (
    <div className={styles.scrollerWrap} ref={wrapRef}>
      <div className={styles.scrollerTrack} ref={trackRef} role="list" aria-label={ariaLabel}>
        {children}
      </div>
      <div className={styles.scrollerArrows}>
        <button className={styles.scrollerArrow} type="button" onClick={() => scroll(-1)} aria-label="Anterior">‹</button>
        <button className={styles.scrollerArrow} type="button" onClick={() => scroll(1)} aria-label="Siguiente">›</button>
      </div>
    </div>
  );
}
