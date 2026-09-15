import WalkingDog from "./WalkingDog";
import { SKELETON_VARIANTS, type SkeletonVariant } from "./SkeletonVariants";
import styles from "./RouteLoading.module.css";

/**
 * Loading propio de Huellas de Vuelta para transiciones de ruta: pensado
 * para usarse como `loading.tsx` (fallback nativo de Suspense de Next.js) —
 * Next solo lo muestra mientras la navegación a esa ruta está realmente
 * pendiente y lo retira apenas termina; nada aquí añade una espera ni una
 * duración mínima.
 *
 * Combina dos elementos:
 * - un perro caminando (`WalkingDog`), el toque de marca;
 * - un skeleton (`SKELETON_VARIANTS`) que imita la estructura real de la
 *   pantalla que está a punto de aparecer ("el contenido ya viene").
 *
 * Componente de servidor puro (sin `"use client"`, sin JS propio): toda la
 * animación es CSS. Colores 100% por variables de tema — se adapta solo a
 * claro/oscuro. Respeta `prefers-reduced-motion` (ver módulos CSS).
 */
export default function RouteLoading({
  variant = "generic",
  label = "Cargando…",
}: {
  variant?: SkeletonVariant;
  label?: string;
}) {
  const SkeletonBody = SKELETON_VARIANTS[variant];
  return (
    <div className={styles.wrap} role="status">
      <div className={styles.dogRow}>
        <WalkingDog />
      </div>
      <div className={styles.skeletonArea}>
        <SkeletonBody />
      </div>
      <span className={styles.srText}>{label}</span>
    </div>
  );
}
