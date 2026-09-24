"use client";

import { useEffect, useRef, useState } from "react";
import { startScanner, type ScanFormat, type ScannerError, type ScannerSession } from "@/lib/scanner/scanner";
import controls from "@/components/ui/controls.module.css";
import styles from "./vet.module.css";

const ERROR_TEXT: Record<string, string> = {
  "permission-denied": "No diste permiso para usar la cámara. Puedes habilitarlo en los ajustes del navegador o escribir el código a mano.",
  "no-camera": "No encontramos una cámara disponible en este dispositivo.",
  "insecure-context": "La cámara solo funciona en una conexión segura (https).",
  unsupported: "Este navegador no permite usar la cámara. Escribe el código a mano.",
  failed: "No fue posible iniciar la cámara. Inténtalo de nuevo.",
};

/**
 * Vista de cámara. Se monta SOLO cuando la veterinaria elige escanear (se
 * carga con `next/dynamic`), y al desmontarse —lectura, cancelar, error, cambio
 * de ruta o pestaña en segundo plano— libera cámara y decodificador.
 * No conoce autorización: solo entrega el texto leído.
 */
export default function CameraScanner({
  format,
  onDetected,
  onCancel,
}: {
  format: ScanFormat;
  onDetected: (text: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onDetectedRef = useRef(onDetected);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let session: ScannerSession | null = null;

    startScanner(video, format, (text) => {
      if (!cancelled) onDetectedRef.current(text);
    })
      .then((s) => {
        // React StrictMode (dev) monta, desmonta y vuelve a montar: si ya se
        // canceló mientras arrancaba, se apaga aquí mismo.
        if (cancelled) s.stop();
        else session = s;
      })
      .catch((e: ScannerError) => {
        if (!cancelled) setError(ERROR_TEXT[e.code] ?? ERROR_TEXT.failed);
      });

    // Una pestaña en segundo plano no debe mantener la cámara encendida.
    const onHidden = () => {
      if (document.hidden) onCancelRef.current();
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onHidden);
      session?.stop();
    };
  }, [format, attempt]);

  return (
    <div className={styles.scanner}>
      <p className={styles.scannerHint}>
        {format === "qr" ? "Apunta la cámara al código QR de la placa." : "Apunta la cámara al código de barras de la placa."}
      </p>
      {error ? (
        <p className={controls.errorText} role="alert">{error}</p>
      ) : (
        <video ref={videoRef} className={styles.video} playsInline muted aria-label="Vista de la cámara" />
      )}
      <div className={controls.buttonRow}>
        {error && (
          <button
            type="button"
            className={controls.button}
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar
          </button>
        )}
        <button type="button" className={controls.buttonSecondary} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
