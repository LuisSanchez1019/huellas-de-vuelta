import styles from "./WalkingDog.module.css";

/**
 * Silueta de un perro caminando: el toque de marca de Huellas de Vuelta sobre
 * el loading. SVG puro + CSS (sin JS, sin dependencias): patas delanteras y
 * traseras balanceándose en fases opuestas, cola que se menea y un vaivén muy
 * leve de todo el cuerpo — todo con `transform` (nunca layout).
 *
 * Silueta neutra (ni perro de raza concreta ni gato), un solo color
 * (`var(--navy-900)`, el mismo tono "tinta" que ya usa el resto de la UI) para
 * que se lea como una marca limpia, no como un ícono infantil.
 *
 * Con `prefers-reduced-motion: reduce` (ver módulo CSS) el perro queda de pie,
 * quieto, sin ninguna animación.
 */
export default function WalkingDog() {
  return (
    <svg className={styles.scene} viewBox="0 0 72 44" width="72" height="44" aria-hidden="true">
      <g className={styles.dogGroup}>
        <g className={styles.legBack}>
          <rect x="21" y="26" width="3" height="12" rx="1.5" />
          <rect x="26" y="26" width="3" height="12" rx="1.5" />
        </g>
        <g className={styles.legFront}>
          <rect x="37" y="26" width="3" height="12" rx="1.5" />
          <rect x="42" y="26" width="3" height="12" rx="1.5" />
        </g>

        <path className={styles.tail} d="M17 19 Q10 16 8 8" />

        <ellipse cx="32" cy="22" rx="15" ry="7.5" />
        <path d="M38 8 Q34 14 39 19 Q42 14 40 7 Z" />
        <circle cx="44" cy="14" r="7.2" />
        <ellipse cx="52" cy="16.5" rx="4.2" ry="2.8" />
      </g>
    </svg>
  );
}
