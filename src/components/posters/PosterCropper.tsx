"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  POSTER_MIN_SOURCE_WIDTH,
  POSTER_RATIO,
  POSTER_RECOMMENDED_LABEL,
  renderPosterCrop,
  type PosterSource,
  type PreparedPoster,
} from "@/lib/images/preparePoster";
import controls from "@/components/ui/controls.module.css";
import styles from "./postersPanel.module.css";

interface Props {
  source: PosterSource;
  orgName: string;
  title?: string;
  disabled?: boolean;
  onApply: (result: PreparedPoster) => void;
  onPickAnother: () => void;
  onCancel: () => void;
}

/**
 * Recortador de proporción FIJA 3:1. El usuario mueve la imagen y ajusta el
 * zoom; nunca puede cambiar la relación de aspecto ni deformar la imagen. El
 * marco (viewport) siempre queda cubierto por la imagen. El zoom está limitado
 * para que la región recortada nunca baje de 1200 px de ancho en la imagen
 * original (sin ampliación → sin pixelado). Salida: 1200 × 400 px.
 */
export default function PosterCropper({
  source,
  orgName,
  title,
  disabled = false,
  onApply,
  onPickAnother,
  onCancel,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const initedRef = useRef(false);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frameH = frameW / POSTER_RATIO;
  const coverScale = frameW > 0 ? Math.max(frameW / source.width, frameH / source.height) : 1;
  const maxZoom = frameW > 0 ? Math.max(1, frameW / (coverScale * POSTER_MIN_SOURCE_WIDTH)) : 4;
  const dispW = source.width * coverScale * zoom;
  const dispH = source.height * coverScale * zoom;

  const clampX = useCallback(
    (v: number) => Math.min(0, Math.max(Math.min(0, frameW - dispW), v)),
    [frameW, dispW],
  );
  const clampY = useCallback(
    (v: number) => Math.min(0, Math.max(Math.min(0, frameH - dispH), v)),
    [frameH, dispH],
  );

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrameW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Centrar la primera vez; después de eso, siempre re-encajar dentro del marco.
  useEffect(() => {
    if (frameW <= 0) return;
    setTx((prev) => clampX(initedRef.current ? prev : (frameW - dispW) / 2));
    setTy((prev) => clampY(initedRef.current ? prev : (frameH - dispH) / 2));
    initedRef.current = true;
  }, [frameW, dispW, dispH, frameH, clampX, clampY]);

  function onPointerDown(event: React.PointerEvent) {
    if (disabled || busy) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, tx, ty };
  }
  function onPointerMove(event: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setTx(clampX(d.tx + (event.clientX - d.x)));
    setTy(clampY(d.ty + (event.clientY - d.y)));
  }
  function onPointerUp(event: React.PointerEvent) {
    dragRef.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
  }

  async function apply() {
    setError(null);
    setBusy(true);
    try {
      const s = coverScale * zoom; // px de pantalla por px de la imagen original
      const result = await renderPosterCrop(source.image, {
        sx: -tx / s,
        sy: -ty / s,
        sw: frameW / s,
        sh: frameH / s,
      });
      onApply(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible recortar la imagen.");
      setBusy(false);
    }
  }

  return (
    <div className={styles.cropWrap}>
      <p className={styles.previewLabel}>
        Ajusta el encuadre (arrastra la imagen y usa el zoom). El poster siempre es 3:1 ·{" "}
        {POSTER_RECOMMENDED_LABEL}
      </p>

      <div
        ref={frameRef}
        className={styles.cropFrame}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="group"
        aria-label="Recortador del poster, proporción 3 a 1"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen local para recortar */}
        <img
          src={source.objectUrl}
          alt=""
          className={styles.cropImg}
          draggable={false}
          style={{
            width: `${dispW}px`,
            height: `${dispH}px`,
            transform: `translate(${tx}px, ${ty}px)`,
          }}
        />
        {title?.trim() && (
          <div className={styles.previewCaption} aria-hidden="true">
            <span className={styles.previewCaptionTitle}>{title.trim()}</span>
            <span className={styles.previewCaptionOrg}>{orgName}</span>
          </div>
        )}
      </div>

      <label className={styles.cropZoomRow}>
        <span>Zoom</span>
        <input
          type="range"
          min={1}
          max={Math.max(1.01, maxZoom)}
          step={0.01}
          value={Math.min(zoom, Math.max(1.01, maxZoom))}
          onChange={(event) => setZoom(Number(event.target.value))}
          disabled={disabled || busy}
          aria-label="Zoom de la imagen"
        />
      </label>

      {error && <p className={controls.errorText}>{error}</p>}

      <div className={controls.buttonRow}>
        <button type="button" className={controls.button} onClick={apply} disabled={disabled || busy}>
          {busy ? "Recortando…" : "Aplicar recorte"}
        </button>
        <button
          type="button"
          className={controls.buttonSecondary}
          onClick={onPickAnother}
          disabled={disabled || busy}
        >
          Elegir otra imagen
        </button>
        <button type="button" className={controls.buttonSecondary} onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
