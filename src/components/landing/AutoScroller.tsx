"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import styles from "./landing.module.css";

const PIXELS_PER_SECOND = 45;
const GAP_PX = 20; // matches the 1.25rem gap used between cards

export default function AutoScroller({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = useState(false);
  const [duration, setDuration] = useState(20);

  useEffect(() => {
    function measure() {
      const viewport = viewportRef.current;
      const measureEl = measureRef.current;
      if (!viewport || !measureEl) return;

      const contentWidth = measureEl.scrollWidth;
      const viewportWidth = viewport.clientWidth;
      const overflowing = contentWidth > viewportWidth;

      setAnimate(overflowing);
      if (overflowing) {
        setDuration((contentWidth + GAP_PX) / PIXELS_PER_SECOND);
      }
    }

    measure();

    const resizeObserver = new ResizeObserver(() => measure());
    if (viewportRef.current) resizeObserver.observe(viewportRef.current);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const trackStyle: CSSProperties | undefined = animate ? { animationDuration: `${duration}s` } : undefined;

  return (
    <div className={styles.scrollerWrap}>
      <div className={styles.scrollerViewport} ref={viewportRef}>
        <div className={styles.scrollerMeasure} ref={measureRef} aria-hidden="true">
          {children}
        </div>
        <div
          className={animate ? `${styles.scrollerTrack} ${styles.scrollerTrackAnimated}` : styles.scrollerTrack}
          style={trackStyle}
          role="list"
          aria-label={ariaLabel}
        >
          {animate ? (
            <>
              <div className={styles.scrollerGroup}>{children}</div>
              <div className={styles.scrollerGroup} aria-hidden="true">{children}</div>
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
