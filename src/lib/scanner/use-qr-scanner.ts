'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { parseQrCode } from '@/lib/scanner/parse-qr';

/** Error surfaced by the hook itself (camera + invalid-code). */
export type QrScanError =
  | 'permission-denied'
  | 'camera-unavailable'
  | 'invalid-code'
  | 'not-found';

/** Outcome of the caller's async decode handler. */
export type QrDecodeOutcome = { outcome: 'ok' } | { outcome: 'failure' };

export type UseQrScannerOptions = {
  /** Called with the raw decoded string; may resolve asynchronously. */
  onDecode: (raw: string) => Promise<QrDecodeOutcome> | void;
  /** Optional notification when a raw string is not a valid botellón code. */
  onInvalidCode?: () => void;
  /** Lockout window for repeat decodes of the same code, in ms. */
  lockoutMs?: number;
};

export type UseQrScanner = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraError: 'permission-denied' | 'camera-unavailable' | null;
  decodeError: QrScanError | null;
  /** Lets the caller surface not-found / no-client while scanning continues. */
  setDecodeError: (error: QrScanError | null) => void;
  /** Idempotent: stops every track and cancels the rAF loop once. */
  stop: () => void;
};

// ≥66ms between frames ≈ ≤15fps decode rate.
const DECODE_INTERVAL_MS = 66;
// Downscale the capture surface so jsQR stays fast on phones.
const MAX_CANVAS_SIZE = 640;
// Ignore repeat decodes of the same code for 1s (no double handling).
const DEFAULT_LOCKOUT_MS = 1000;

/**
 * Shared camera + QR decode loop. One effect owns the stream and the rAF loop;
 * cleanup cancels the loop and stops every track (StrictMode-safe, using a
 * per-effect `disposed` flag). Camera errors replace the video; invalid codes
 * surface as `invalid-code` and keep scanning. Valid codes are handed to the
 * caller's `onDecode`: the loop pauses while it resolves and resumes on a
 * failure outcome; an `ok` outcome stops scanning.
 */
export function useQrScanner(options: UseQrScannerOptions): UseQrScanner {
  const { onDecode, onInvalidCode, lockoutMs = DEFAULT_LOCKOUT_MS } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  // Lockout uses performance.now(): same monotonic clock as the throttle.
  const lastDecodeRef = useRef(-lockoutMs);
  const [cameraError, setCameraError] = useState<
    'permission-denied' | 'camera-unavailable' | null
  >(null);
  const [decodeError, setDecodeError] = useState<QrScanError | null>(null);

  // Keep callbacks in refs so the effect (which runs once on mount) always
  // reads the latest handler without restarting the camera on re-render.
  // Refs are updated in an effect (not during render) per react-hooks/refs.
  const onDecodeRef = useRef(onDecode);
  const onInvalidCodeRef = useRef(onInvalidCode);
  const lockoutMsRef = useRef(lockoutMs);
  useEffect(() => {
    onDecodeRef.current = onDecode;
    onInvalidCodeRef.current = onInvalidCode;
    lockoutMsRef.current = lockoutMs;
  });

  // The active effect instance installs its own idempotent stop closure here,
  // so the public `stop()` always targets the currently-running stream while
  // each effect instance still stops its OWN stream on cleanup (StrictMode-safe).
  const stopRef = useRef<() => void>(() => {});
  const stop = useCallback(() => {
    stopRef.current();
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let lastFrame = 0;
    // Per-effect-instance flag: survives StrictMode double-mount, where a
    // shared ref would let the first mount's late resolution slip through.
    let disposed = false;
    let stopped = false;

    const stopStream = () => {
      stream?.getTracks().forEach((track) => track.stop());
    };

    const doStop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(rafId);
      stopStream();
    };

    stopRef.current = doStop;

    const handleDecoded = async (raw: string) => {
      const parsed = parseQrCode(raw);
      if (!parsed) {
        setDecodeError('invalid-code');
        onInvalidCodeRef.current?.();
        return;
      }

      const now = performance.now();
      if (now - lastDecodeRef.current < lockoutMsRef.current) return;
      lastDecodeRef.current = now;

      // Pause the loop while resolving so duplicate frames don't double-fire.
      cancelAnimationFrame(rafId);
      try {
        const outcome = await onDecodeRef.current(raw);
        if (disposed) return;

        if (outcome && outcome.outcome === 'ok') {
          // Caller handled the code (e.g. navigated) — stop scanning.
          doStop();
          return;
        }
      } catch (err) {
        // A rejected handler must never kill the scan loop silently: log the
        // error and let the finally below schedule the next frame so scanning
        // continues (see review finding R4-1).
        console.error('useQrScanner: onDecode rejected', err);
        if (disposed) return;
      } finally {
        // Resume scanning on failure/error paths only — never after stop() or
        // an ok outcome (which stop the stream).
        if (!disposed && !stopped) rafId = requestAnimationFrame(loop);
      }
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
        setCameraError('camera-unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        // Guard late resolution after unmount / stop (no srcObject on a
        // detached video, and no stream to leak after an explicit stop).
        if (disposed || stopped) {
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
          setCameraError('permission-denied');
        } else {
          setCameraError('camera-unavailable');
        }
      }
    };

    void start();

    return () => {
      disposed = true;
      doStop();
    };
  }, []);

  return { videoRef, cameraError, decodeError, setDecodeError, stop };
}
