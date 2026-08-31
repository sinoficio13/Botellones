'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ScanLine, X } from 'lucide-react';
import { getBotellonByCodigo } from '@/lib/db/botellones';
import type { CargaState } from '@/lib/db/cargas';
import { parseQrCode } from '@/lib/scanner/parse-qr';
import { playBeep } from '@/lib/scanner/beep';
import {
  useQrScanner,
  type QrDecodeOutcome,
} from '@/lib/scanner/use-qr-scanner';
import { useSesionCarga } from '@/hooks/useSesionCarga';
import { SesionCarga } from '@/components/operaciones/sesion-carga';
import { ResultadoCarga } from '@/components/operaciones/resultado-carga';
import { BuscadorClienteCarga } from '@/components/operaciones/buscador-cliente-carga';

type ScanError =
  | 'permission-denied'
  | 'camera-unavailable'
  | 'invalid-code'
  | 'not-found';

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
};

/**
 * Unified batch scanner modal. Replaces the old single-flow scanner (which
 * redirected to /recargas/nueva) and the camera-less "Recibir botellón" modal
 * (which only accepted manual codes): every QR surface now opens THIS modal,
 * which scans + accumulates into a session in-place (no navigation).
 *
 * The session logic lives in `useSesionCarga` (same as the old batch
 * terminal): each bottle pre-fills its own destination from its current
 * estado, dedupe flashes repeated codes with a beep, and a single confirm
 * posts one `registrarOperacion` per destino group. The client search, manual
 * digits-only entry (BOT- prefix implied) and the shared result view render
 * inside the fixed overlay; header/close stay visible on the result screen.
 *
 * The camera/decode lifecycle lives in `useQrScanner`; this component only
 * accumulates decoded bottles. `onDecode` is kept in a ref (updated in an
 * effect) so the camera never restarts on re-render while always reading the
 * latest handler — the same circular-dependency pattern the previous modal
 * used.
 */
export function ScannerModal({ onClose }: { onClose: () => void }) {
  const { items, flashId, agregar, setDestino, quitar, limpiar, confirmar } =
    useSesionCarga();
  // Manual digits-only entry (BOT- prefix implied) — camera-less fallback.
  const [codigoManual, setCodigoManual] = useState('');
  const [errorManual, setErrorManual] = useState<string | null>(null);
  // Local pending state for the async confirm (one call per destino group).
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<CargaState[] | null>(null);

  // The hook keeps `onDecode` in a ref updated every render, so we forward a
  // stable wrapper and point it at the latest handler. The handler reads
  // `setDecodeError` from the hook, which creates a circular dependency;
  // storing it in a ref (updated in an effect, per react-hooks) breaks that
  // cycle without restarting the camera on re-render.
  const handleDecodeRef = useRef<
    (raw: string) => Promise<QrDecodeOutcome> | void
  >(async () => ({ outcome: 'failure' }));

  const { videoRef, cameraError, decodeError, setDecodeError, stop } =
    useQrScanner({ onDecode: (raw) => handleDecodeRef.current(raw) });

  useEffect(() => {
    handleDecodeRef.current = async (raw: string): Promise<QrDecodeOutcome> => {
      const parsed = parseQrCode(raw);
      if (!parsed) {
        setDecodeError('invalid-code');
        return { outcome: 'failure' };
      }

      const botellon = await getBotellonByCodigo(parsed.codigo);
      if (!botellon) {
        setDecodeError('not-found');
        return { outcome: 'failure' };
      }

      // No navigation anymore: accumulate into the session and keep scanning
      // (the hook treats the failure outcome as "decode consumed").
      const added = await agregar(botellon);
      if (!added) playBeep();
      setDecodeError(null);
      return { outcome: 'failure' };
    };
  });

  // Escape closes the modal (keyboard affordance).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const resultadoOk = resultado !== null && resultado.every((r) => r.success);

  // Release the camera stream once a batch fully succeeds: the result view
  // removes the <video>, so without this the getUserMedia track (camera LED)
  // would stay active. stop() is idempotent. A FAILED attempt keeps the
  // camera alive — "Seguir editando" returns to the live scanner.
  useEffect(() => {
    if (resultadoOk) stop();
  }, [resultadoOk, stop]);

  const accionables = items.filter((i) => i.destino !== null);
  const canConfirmar = accionables.length > 0 && !confirmando;
  const enSesion = new Set(items.map((i) => i.id));

  function onManualChange(e: ChangeEvent<HTMLInputElement>) {
    // Digits only; tolerates pasted full codes like "BOT-00045".
    setCodigoManual(e.target.value.replace(/\D/g, ''));
  }

  async function manejarIngresoManual() {
    const digits = codigoManual.trim();
    if (digits === '') return;
    const botellon = await getBotellonByCodigo(`BOT-${digits}`);
    if (!botellon) {
      setErrorManual('Botellón no encontrado');
      return;
    }
    setErrorManual(null);
    setCodigoManual('');
    const added = await agregar(botellon);
    if (!added) playBeep();
  }

  async function manejarConfirmar() {
    if (confirmando) return;
    setConfirmando(true);
    try {
      setResultado(await confirmar());
    } finally {
      setConfirmando(false);
    }
  }

  const activeCameraError = cameraError ? ERROR_COPY[cameraError] : null;
  const activeDecodeError = decodeError ? ERROR_COPY[decodeError] : null;

  let cuerpo: React.ReactNode;

  if (resultado) {
    cuerpo = (
      <ResultadoCarga
        resultado={resultado}
        items={items}
        onListo={() => {
          limpiar();
          onClose();
        }}
        onSeguirEditando={() => setResultado(null)}
      />
    );
  } else {
    cuerpo = (
      <div className="space-y-4">
        {activeCameraError ? (
          /* Camera-error branch: manual digits-only entry replaces the video. */
          <div className="rounded-2xl bg-zinc-50 px-6 py-8 text-center dark:bg-zinc-900">
            <ScanLine className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {activeCameraError.title}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {activeCameraError.hint}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void manejarIngresoManual();
              }}
              className="mx-auto mt-5 max-w-xs text-left"
            >
              <label
                htmlFor="scanner-manual-codigo"
                className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                ¿Sin cámara? Ingresá el código manualmente
              </label>
              <div className="mt-1 flex gap-2">
                <div className="flex min-w-0 flex-1 items-center rounded-md border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  <span className="pl-3 font-mono text-sm text-zinc-400">BOT-</span>
                  <input
                    id="scanner-manual-codigo"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="00000"
                    value={codigoManual}
                    onChange={onManualChange}
                    className="w-full min-w-0 bg-transparent px-2 py-2 font-mono text-sm text-zinc-900 outline-none dark:text-zinc-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={codigoManual === '' || confirmando}
                  className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Agregar a la sesión
                </button>
              </div>
              {errorManual && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {errorManual}
                </p>
              )}
            </form>
          </div>
        ) : (
          /* Camera block with a centered reticle; decode errors overlay it. */
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-black">
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

        {/* Client search — alternative to camera/manual entry; adds the chosen
            client's bottles to the SAME session (dedupe + flash via the hook). */}
        <BuscadorClienteCarga onAgregar={agregar} enSesion={enSesion} />

        {/* Session */}
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Sesión ({items.length})
          </h3>
          <SesionCarga
            items={items}
            flashId={flashId}
            onSetDestino={setDestino}
            onQuitar={quitar}
          />
        </div>

        {/* Confirm */}
        <button
          type="button"
          onClick={() => void manejarConfirmar()}
          disabled={!canConfirmar}
          className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirmando
            ? 'Confirmando…'
            : `Confirmar (${accionables.length} botellones)`}
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escanear código QR"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
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
        <div className="overflow-y-auto px-4 py-4">{cuerpo}</div>
      </div>
    </div>
  );
}
