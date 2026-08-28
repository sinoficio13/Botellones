'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { ScanLine } from 'lucide-react';
import { getBotellonByCodigo } from '@/lib/db/botellones';
import type { CargaState } from '@/lib/db/cargas';
import { parseQrCode } from '@/lib/scanner/parse-qr';
import { playBeep } from '@/lib/scanner/beep';
import { useQrScanner, type QrDecodeOutcome } from '@/lib/scanner/use-qr-scanner';
import { useSesionCarga } from '@/hooks/useSesionCarga';
import { SesionCarga } from '@/components/operaciones/sesion-carga';
import { ResultadoCarga } from '@/components/operaciones/resultado-carga';
import { BuscadorClienteCarga } from '@/components/operaciones/buscador-cliente-carga';

/**
 * Batch scanning terminal. The operator scans or types bottle codes freely;
 * each session row shows the bottle's CURRENT estado and a PRE-FILLED
 * destination (current → target), so a single confirm can record a MIXED batch
 * (2 recibir + 1 recargar + 3 listo) in one go via `useSesionCarga`. Rows for
 * bottles already in 'listo'/'delivery' have no destination here.
 *
 * Accumulation is handler-driven (in `onDecode`), never `setState` in an
 * effect. The same code is deduped in-session (repeat → amber flash + beep);
 * fecha/hora are never edited — the record always gets the current timestamp,
 * computed at submit time. The result view renders per-row outcomes; "Listo"
 * remounts the batch (via the parent key) so the camera and session reset for
 * the next batch.
 */
function CargaTerminal({ onListo }: { onListo: () => void }) {
  const { items, flashId, agregar, setDestino, quitar, limpiar, confirmar } = useSesionCarga();
  // Manual digits-only entry (BOT- prefix implied).
  const [codigoManual, setCodigoManual] = useState('');
  const [errorManual, setErrorManual] = useState<string | null>(null);
  // Local pending state for the async confirm (one call per destino group).
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<CargaState[] | null>(null);

  const { videoRef, cameraError, decodeError, setDecodeError, stop } = useQrScanner({
    onDecode: async (raw: string): Promise<QrDecodeOutcome> => {
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

      // No global operation anymore: the hook dedupes and pre-fills each
      // bottle's own destination from its current estado.
      setDecodeError(null);
      const added = await agregar(botellon);
      if (!added) playBeep();
      // Keep the failure outcome after accumulation: the hook treats it as
      // "decode consumed" and resumes scanning for the next botellon.
      return { outcome: 'failure' };
    },
  });

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

  async function manejarConfirmar() {
    if (confirmando) return;
    setConfirmando(true);
    try {
      setResultado(await confirmar());
    } finally {
      setConfirmando(false);
    }
  }

  function manejarSeguirEditando() {
    setResultado(null);
  }

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

  const activeCameraError = cameraError;
  const activeDecodeError = decodeError;

  if (resultado) {
    return (
      <div className="mt-4">
        <ResultadoCarga
          resultado={resultado}
          items={items}
          onListo={() => {
            limpiar();
            onListo();
          }}
          onSeguirEditando={manejarSeguirEditando}
        />
      </div>
    );
  }

  return (
    <>
      {/* Camera */}
      <div className="mt-4 aspect-square overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {activeCameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-6 text-center">
            <ScanLine className="h-8 w-8 text-zinc-300" />
            <p className="mt-3 text-sm font-semibold text-white">
              {activeCameraError === 'permission-denied'
                ? 'Permiso de cámara denegado'
                : 'Cámara no disponible'}
            </p>
          </div>
        )}
        {!activeCameraError && activeDecodeError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-6 text-center">
            <ScanLine className="h-8 w-8 text-zinc-300" />
            <p className="mt-3 text-sm font-semibold text-white">
              {activeDecodeError === 'invalid-code'
                ? 'Código no válido'
                : activeDecodeError === 'not-found'
                  ? 'Botellón no encontrado'
                  : 'Error de escaneo'}
            </p>
          </div>
        )}
      </div>

      {/* Manual code entry — camera-less PC fallback. Lives OUTSIDE the camera
          block so the input never overlaps the <video> element. Digits only;
          the BOT- prefix is implied and rendered as a visible label. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void manejarIngresoManual();
        }}
        className="mt-4"
      >
        <label
          htmlFor="carga-manual-codigo"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          ¿Sin cámara? Ingresá el código manualmente
        </label>
        <div className="mt-1 flex gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-md border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <span className="pl-3 font-mono text-sm text-zinc-400">BOT-</span>
            <input
              id="carga-manual-codigo"
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
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorManual}</p>
        )}
      </form>

      {/* Client search — alternative to the digits-only entry. Adds the chosen
          client's bottles to the SAME session (dedupe + flash via the hook). */}
      <div className="mt-4">
        <BuscadorClienteCarga onAgregar={agregar} enSesion={enSesion} />
      </div>

      {/* Session */}
      <div className="mt-4">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Sesión ({items.length})
        </h2>
        <SesionCarga items={items} flashId={flashId} onSetDestino={setDestino} onQuitar={quitar} />
      </div>

      {/* Confirm */}
      <button
        type="button"
        onClick={() => void manejarConfirmar()}
        disabled={!canConfirmar}
        className="mt-6 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {confirmando ? 'Confirmando…' : `Confirmar (${accionables.length} botellones)`}
      </button>
    </>
  );
}

export default function CargaPage() {
  const [batch, setBatch] = useState(0);
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Carga de botellones
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Escaneá los QR o ingresá los códigos; cada botellón se registra según su estado.
      </p>
      {/* Keyed remount: "Listo" starts a fresh batch with a live camera. */}
      <CargaTerminal key={batch} onListo={() => setBatch((b) => b + 1)} />
    </div>
  );
}