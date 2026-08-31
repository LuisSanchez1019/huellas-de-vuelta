"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import styles from "./landing.module.css";

export default function HorizontalScroller({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scroll(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * 300, behavior: "smooth" });
  }

  return (
    <div className={styles.scrollerWrap}>
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
