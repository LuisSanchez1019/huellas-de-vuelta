import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

/**
 * Bloque fantasma reutilizable: una superficie con muy baja opacidad y un
 * barrido ("shimmer") sutil, hecho solo con `transform`/`opacity` (sin
 * `background-position`, para no forzar repintados innecesarios). Es el
 * ladrillo con el que se componen todas las variantes de skeleton — nunca se
 * usa "pelado" en el centro de la pantalla, siempre dentro de un layout que
 * imita la estructura real de la página (ver `SkeletonVariants.tsx`).
 *
 * Decorativo: cada bloque lleva `aria-hidden`; el estado de carga en sí lo
 * comunica el `role="status"` + texto accesible del contenedor (`RouteLoading`).
 */
export default function Skeleton({
  width,
  height = "1rem",
  radius = ".4rem",
  circle = false,
  className,
  style,
}: {
  width?: string | number;
  height?: string | number;
  radius?: string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.block} ${className ?? ""}`}
      style={{
        width,
        height,
        borderRadius: circle ? "50%" : radius,
        ...style,
      }}
    />
  );
}
