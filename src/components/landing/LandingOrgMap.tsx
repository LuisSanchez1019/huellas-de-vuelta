"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./landing.module.css";

// El mapa (y Leaflet) se cargan en su propio chunk, solo en cliente.
const OrgMapInner = dynamic(() => import("./OrgMapInner"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading} aria-hidden="true" />,
});

/**
 * Puerta de rendimiento: el mapa interactivo (y la librería Leaflet) no se
 * descargan ni se montan hasta que la sección está cerca del viewport. Así el
 * resto del Landing carga sin penalización. Combina IntersectionObserver con
 * una comprobación en `scroll` como respaldo.
 */
export default function LandingOrgMap() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) return;
    const node = ref.current;
    if (!node) return;

    let done = false;
    const activate = () => {
      if (done) return;
      done = true;
      setActive(true);
      cleanup();
    };
    const nearViewport = () => {
      const rect = node.getBoundingClientRect();
      return rect.top < window.innerHeight + 400 && rect.bottom > -400;
    };
    const onScroll = () => {
      if (nearViewport()) activate();
    };

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) activate();
        },
        { rootMargin: "400px 0px" },
      );
      io.observe(node);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // Comprobación inicial (tras el primer frame) por si ya está a la vista.
    const raf = requestAnimationFrame(() => {
      if (nearViewport()) activate();
    });

    function cleanup() {
      cancelAnimationFrame(raf);
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    }
    return cleanup;
  }, [active]);

  return (
    <div ref={ref} className={styles.mapEmbed}>
      {active ? <OrgMapInner /> : <div className={styles.mapLoading} aria-hidden="true" />}
    </div>
  );
}
