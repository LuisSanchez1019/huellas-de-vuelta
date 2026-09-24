/**
 * Capa de escáner (cámara + decodificación). NO conoce autorización ni Supabase:
 * solo entrega el texto leído. Lo demás (normalizar, identificar, pedir acceso)
 * vive en `lib/vet/*`. Así se puede reemplazar por el escáner nativo de
 * Capacitor/Android sin tocar la lógica de identificación ni el backend.
 *
 * - La cámara se pide SOLO cuando se llama a `startScanner`.
 * - ZXing se carga con `import()` dinámico y solo si el navegador no trae
 *   `BarcodeDetector` para el formato pedido.
 * - `stop()` libera cámara y decodificador por completo (es idempotente).
 */

export type ScanFormat = "qr" | "barcode";

export type ScannerErrorCode =
  | "permission-denied"
  | "no-camera"
  | "insecure-context"
  | "unsupported"
  | "failed";

export class ScannerError extends Error {
  readonly code: ScannerErrorCode;
  constructor(code: ScannerErrorCode) {
    super(code);
    this.code = code;
  }
}

export interface ScannerSession {
  stop: () => void;
}

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

const NATIVE_FORMAT: Record<ScanFormat, string> = { qr: "qr_code", barcode: "code_128" };

function mapMediaError(error: unknown): ScannerError {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return new ScannerError("permission-denied");
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
    return new ScannerError("no-camera");
  }
  return new ScannerError("failed");
}

function releaseStream(stream: MediaStream | null, video: HTMLVideoElement): void {
  stream?.getTracks().forEach((track) => track.stop());
  try {
    video.pause();
  } catch {
    /* el elemento pudo desmontarse */
  }
  video.srcObject = null;
}

/**
 * Enciende la cámara sobre `video` y llama a `onResult` UNA sola vez con el
 * primer texto leído (y detiene todo). Cualquier error de arranque rechaza la
 * promesa con un `ScannerError` (la cámara queda liberada).
 */
export async function startScanner(
  video: HTMLVideoElement,
  format: ScanFormat,
  onResult: (text: string) => void,
): Promise<ScannerSession> {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new ScannerError("unsupported");
  }
  if (!window.isSecureContext) {
    throw new ScannerError("insecure-context");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
  } catch (error) {
    throw mapMediaError(error);
  }

  let stopped = false;
  let stopLoop: (() => void) | null = null;
  let held: MediaStream | null = stream;

  const session: ScannerSession = {
    stop() {
      if (stopped) return;
      stopped = true;
      stopLoop?.();
      releaseStream(held, video);
      held = null;
    },
  };
  const deliver = (text: string) => {
    if (stopped) return;
    session.stop();
    onResult(text);
  };

  try {
    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    if (stopped) return session; // se canceló mientras arrancaba

    const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    let detector: BarcodeDetectorLike | null = null;
    if (Native) {
      try {
        const supported = (await Native.getSupportedFormats?.()) ?? [];
        if (supported.includes(NATIVE_FORMAT[format])) {
          detector = new Native({ formats: [NATIVE_FORMAT[format]] });
        }
      } catch {
        detector = null;
      }
    }

    if (detector) {
      const active = detector;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const tick = async () => {
        if (stopped) return;
        try {
          const found = await active.detect(video);
          if (found.length > 0 && found[0].rawValue) {
            deliver(found[0].rawValue);
            return;
          }
        } catch {
          /* fotograma sin datos todavía: se reintenta */
        }
        if (!stopped) timer = setTimeout(tick, 150);
      };
      stopLoop = () => {
        if (timer) clearTimeout(timer);
      };
      void tick();
    } else {
      // Respaldo: ZXing (solo se descarga aquí, bajo demanda).
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);
      if (stopped) return session;
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        format === "qr" ? BarcodeFormat.QR_CODE : BarcodeFormat.CODE_128,
      ]);
      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 500,
      });
      const controls = await reader.decodeFromStream(stream, video, (result) => {
        if (result) deliver(result.getText());
      });
      if (stopped) {
        controls.stop();
        return session;
      }
      stopLoop = () => controls.stop();
    }
  } catch (error) {
    session.stop();
    if (error instanceof ScannerError) throw error;
    throw mapMediaError(error);
  }

  return session;
}
