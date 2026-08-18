'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScanLine, X } from 'lucide-react';
import jsQR from 'jsqr';
import { getBotellonByCodigo } from '@/lib/db/botellones';
import { parseQrCode } from '@/lib/scanner/parse-qr';

type ScanError =
  | { type: 'permission-denied' }
  | { type: 'camera-unavailable' }
  | { type: 'invalid-code' }
  | { type: 'not-found' }
  | { type: 'no-client' };

// ≥66ms between frames ≈ ≤15fps decode rate.
const DECODE_INTERVAL_MS = 66;
// Downscale the capture surface so jsQR stays fast on phones.
const MAX_CANVAS_SIZE = 640;
// Ignore repeat decodes of the same code for 1s (no double redirect).
const DECODE_LOCKOUT_MS = 1000;

const ERROR_COPY: Record<ScanError['type'], { title: string; hint: string }> = {
  'permission-denied': {
    title: 'Permiso de cámara denegado',
    hint: 'Habilita el acceso a la cámara en los ajustes del navegador y vuelve a intentarlo.',
  },
  'camera-unavailable': {
    title: 'Cámara no disponible',
    hint: 'No se pudo acceder a la cámara. Asegúrate de usar una conexión segura (HTTPS).',
  },
  'invalid-code': {
    title: 'Código no válido',
    hint: 'El código escaneado no pertenece a un botellón. Continúa escaneando.',
  },
  'not-found': {
    title: 'Botellón no encontrado',
    hint: 'No se encontró un botellón con ese código. Continúa escaneando.',
  },
  'no-client': {
    title: 'Sin cliente asignado',
    hint: 'Este botellón no tiene un cliente asignado. Continúa escaneando.',
  },
};

/**
 * Camera scanner modal. One effect owns the stream and the decode loop;
 * cleanup cancels the rAF loop and stops every track (StrictMode-safe).
 *
 * Camera errors (denied/unavailable) replace the video — there is no stream.
 * Decode errors (invalid/not-found/no-client) overlay the video so scanning
 * can continue, per the spec scenarios.
 */
export function ScannerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  // Lockout uses performance.now(): same monotonic clock as the throttle.
  const lastDecodeRef = useRef(-DECODE_LOCKOUT_MS);
  const [cameraError, setCameraError] = useState<ScanError | null>(null);
  const [decodeError, setDecodeError] = useState<ScanError | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let lastFrame = 0;
    // Per-effect-instance flag: survives StrictMode double-mount, where a
    // shared ref would let the first mount's late resolution slip through.
    let disposed = false;

    const stopStream = () => {
      stream?.getTracks().forEach((track) => track.stop());
    };

    const handleDecoded = async (raw: string) => {
      const parsed = parseQrCode(raw);
      if (!parsed) {
        setDecodeError({ type: 'invalid-code' });
        return;
      }

      const now = performance.now();
      if (now - lastDecodeRef.current < DECODE_LOCKOUT_MS) return;
      lastDecodeRef.current = now;

      // Pause the loop while resolving so duplicate frames don't double-fire.
      cancelAnimationFrame(rafId);
      const botellon = await getBotellonByCodigo(parsed.codigo);
      if (disposed) return;

      if (!botellon) {
        setDecodeError({ type: 'not-found' });
      } else if (!botellon.cliente_id) {
        setDecodeError({ type: 'no-client' });
      } else {
        stopStream();
        onClose();
        router.push(`/recargas/nueva?botellon_id=${botellon.id}`);
        return;
      }

      // Failure paths keep scanning (spec scenarios).
      rafId = requestAnimationFrame(loop);
    };

    const decodeFrame = () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

      const scale = Math.min(
        1,
        MAX_CANVAS_SIZE / Math.max(video.videoWidth, video.videoHeight)
      );
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const qr = jsQR(imageData.data, imageData.width, imageData.height);
      if (qr?.data) void handleDecoded(qr.data);
    };

    const loop = () => {
      if (disposed) return;
      rafId = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - lastFrame < DECODE_INTERVAL_MS) return;
      lastFrame = now;
      decodeFrame();
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError({ type: 'camera-unavailable' });
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        // Guard late resolution after unmount (no srcObject on a detached video).
        if (disposed) {
          stopStream();
          return;
        }
        const video = videoRef.current;
        if (!video) {
          stopStream();
          return;
        }
        video.srcObject = stream;
        void video.play().catch(() => {});
        rafId = requestAnimationFrame(loop);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setCameraError({ type: 'permission-denied' });
        } else {
          setCameraError({ type: 'camera-unavailable' });
        }
      }
    };

    void start();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      stopStream();
    };
  }, [onClose, router]);

  const activeCameraError = cameraError ? ERROR_COPY[cameraError.type] : null;
  const activeDecodeError = decodeError ? ERROR_COPY[decodeError.type] : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escanear código QR"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Escanear QR
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {activeCameraError ? (
          <div className="px-6 py-10 text-center">
            <ScanLine className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {activeCameraError.title}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {activeCameraError.hint}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="relative aspect-square bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-48 rounded-lg border-2 border-white/70" />
            </div>
            {activeDecodeError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-6 text-center">
                <ScanLine className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                <p className="mt-3 text-sm font-semibold text-white">
                  {activeDecodeError.title}
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  {activeDecodeError.hint}
                </p>
              </div>
            ) : (
              <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-white/80">
                Apunta la cámara al código QR del botellón
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}