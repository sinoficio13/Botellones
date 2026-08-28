'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScanLine, X } from 'lucide-react';
import { getBotellonByCodigo } from '@/lib/db/botellones';
import { parseQrCode } from '@/lib/scanner/parse-qr';
import {
  useQrScanner,
  type QrDecodeOutcome,
} from '@/lib/scanner/use-qr-scanner';
import { cn } from '@/lib/utils';

type ScanError =
  | 'permission-denied'
  | 'camera-unavailable'
  | 'invalid-code'
  | 'not-found'
  | 'no-client';

type ScanMode = 'recarga' | 'carga';

const ERROR_COPY: Record<ScanError, { title: string; hint: string }> = {
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
 * Camera scanner modal. Hosts a `Recarga` | `Carga` mode toggle; in `Carga`
 * mode it hands off to the batch page (`/recargas/carga`) with no decode
 * processing, while `Recarga` (default) keeps the single-flow behavior:
 * decode via `useQrScanner`, then redirect to the recarga confirm step.
 *
 * The camera/decode lifecycle lives in `useQrScanner`; this component only
 * selects the destination flow. The `no-client` outcome is caller-side (the
 * hook's error type does not include it), so it is tracked locally.
 */
export function ScannerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<ScanMode>('recarga');
  const [noClient, setNoClient] = useState(false);
  // Manual code entry — camera-less PC fallback on the camera-error branch.
  const [codigoManual, setCodigoManual] = useState('');
  const [errorManual, setErrorManual] = useState<string | null>(null);

  // The hook keeps `onDecode` in a ref updated every render, so we forward a
  // stable wrapper and point it at the latest handler. The handler reads
  // `stop`/`setDecodeError` from the hook, which creates a circular
  // dependency; storing it in a ref (updated in an effect, per react-hooks)
  // breaks that cycle without restarting the camera on re-render.
  const handleDecodeRef = useRef<
    (raw: string) => Promise<QrDecodeOutcome> | void
  >(async () => ({ outcome: 'failure' }));

  const { videoRef, cameraError, decodeError, setDecodeError, stop } =
    useQrScanner({ onDecode: (raw) => handleDecodeRef.current(raw) });

  useEffect(() => {
    handleDecodeRef.current = async (raw: string): Promise<QrDecodeOutcome> => {
      // Carga mode performs no decode processing — handoff is button-driven.
      if (mode !== 'recarga') return { outcome: 'failure' };

      const parsed = parseQrCode(raw);
      if (!parsed) return { outcome: 'failure' };

      const botellon = await getBotellonByCodigo(parsed.codigo);
      if (!botellon) {
        setDecodeError('not-found');
        return { outcome: 'failure' };
      }
      if (!botellon.cliente_id) {
        setNoClient(true);
        return { outcome: 'failure' };
      }

      stop();
      onClose();
      router.push(`/recargas/nueva?botellon_id=${botellon.id}`);
      return { outcome: 'ok' };
    };
  });

  const handleCargaHandoff = useCallback(() => {
    stop();
    onClose();
    router.push('/recargas/carga');
  }, [stop, onClose, router]);

  /**
   * Manual fallback submit (camera-error branch). In `carga` mode there is no
   * code to validate — the terminal owns the batch flow with its own manual
   * entry, so the submit just hands off (same destination as handleCargaHandoff).
   * In `recarga` mode the typed code (bare BOT-XXXXX or a full QR URL, via
   * parseQrCode) is resolved and routed exactly like a camera decode.
   */
  async function manejarIngresoManual() {
    const raw = codigoManual.trim();
    if (raw === '') return;

    if (mode === 'carga') {
      setErrorManual(null);
      setCodigoManual('');
      stop();
      onClose();
      router.push('/recargas/carga');
      return;
    }

    const parsed = parseQrCode(raw);
    const codigo = parsed?.codigo ?? raw;
    const botellon = await getBotellonByCodigo(codigo);
    if (!botellon) {
      setErrorManual('Botellón no encontrado');
      return;
    }
    if (!botellon.cliente_id) {
      setNoClient(true);
      return;
    }

    setErrorManual(null);
    setCodigoManual('');
    stop();
    onClose();
    router.push(`/recargas/nueva?botellon_id=${botellon.id}`);
  }

  const activeCameraError = cameraError ? ERROR_COPY[cameraError] : null;
  const activeDecodeError =
    decodeError || noClient ? ERROR_COPY[decodeError ?? 'no-client'] : null;

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

        {/* Mode toggle: only selects the destination flow; does not touch the
            camera/decode lifecycle owned by useQrScanner. */}
        <div
          role="group"
          aria-label="Modo de escaneo"
          className="flex gap-1 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800"
        >
          <button
            type="button"
            aria-pressed={mode === 'recarga'}
            onClick={() => setMode('recarga')}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'recarga'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            )}
          >
            Recarga
          </button>
          <button
            type="button"
            aria-pressed={mode === 'carga'}
            onClick={() => setMode('carga')}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'carga'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            )}
          >
            Carga
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

            {/* Manual fallback so a PC without a camera can still continue.
                A clientless code surfaces here (not over a video) with its own
                dismiss so the staff can type another code. */}
            {noClient ? (
              <div className="mx-auto mt-5 max-w-xs">
                <ScanLine className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Sin cliente asignado
                </p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Este botellón no tiene un cliente asignado. Probá con otro código.
                </p>
                <button
                  type="button"
                  onClick={() => setNoClient(false)}
                  className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Volver a intentar
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void manejarIngresoManual();
                }}
                className="mx-auto mt-5 max-w-xs"
              >
                <label
                  htmlFor="scanner-manual-codigo"
                  className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                >
                  ¿Sin cámara? Ingresá el código del botellón
                </label>
                <input
                  id="scanner-manual-codigo"
                  type="text"
                  placeholder="BOT-00000"
                  value={codigoManual}
                  onChange={(e) => setCodigoManual(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  className="mt-2 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Continuar
                </button>
                {errorManual && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {errorManual}
                  </p>
                )}
              </form>
            )}
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
                {mode === 'carga'
                  ? "Selecciona 'Iniciar carga' para el escaneo por lotes."
                  : 'Apunta la cámara al código QR del botellón'}
              </p>
            )}
          </div>
        )}

        {mode === 'carga' && (
          <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="mb-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Escaneo por lotes para cargar botellones.
            </p>
            <button
              type="button"
              onClick={handleCargaHandoff}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Iniciar carga
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
