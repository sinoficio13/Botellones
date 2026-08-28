'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ScanLine } from 'lucide-react';
import { getBotellonByCodigo } from '@/lib/db/botellones';
import { getCliente } from '@/lib/db/clientes';
import { registrarOperacion, type CargaState } from '@/lib/db/cargas';
import { parseQrCode } from '@/lib/scanner/parse-qr';
import { playBeep } from '@/lib/scanner/beep';
import {
  ESTADO_LABELS,
  OPERACIONES,
  esTransicionValida,
  type Estado,
  type OperacionId,
} from '@/lib/utils/estados';
import { cn } from '@/lib/utils';
import {
  useQrScanner,
  type QrDecodeOutcome,
} from '@/lib/scanner/use-qr-scanner';

/** A botellon accumulated in the transient client-side session. */
type SessionItem = {
  id: string;
  codigo: string;
  cliente: string | null;
  clienteNombre?: string;
  estado?: string;
};

/** A decoded botellon that has no client assigned (op-scoped overlay). */
type NoClient = { id: string; codigo: string };

/** Format a Date as YYYY-MM-DD in local time (for the record's fecha). */
function formatFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a Date as HH:MM in local time (for the record's hora). */
function formatHora(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

const OPERACION_LABELS: Record<OperacionId, string> = {
  recibir: 'Recibir',
  recargar: 'Recargar',
  listo: 'Listo',
};

/**
 * Red badge classes for an invalid (rejected) transition. The removed
 * `danado` key no longer exists in ESTADO_COLORS, so the fallback is an
 * explicit constant instead of a silent empty string.
 */
const BADGE_INVALID = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';

/**
 * Multi-state scanning terminal. Scan botellon QRs, pick an operation
 * (Recibir | Recargar | Listo), and advance each botellon's estado by the
 * selected operation in one confirm via `registrarOperacion`.
 *
 * Accumulation is handler-driven (in `onDecode`), never `setState` in an
 * effect. The same code is deduped in-session; a repeat scan beeps and flashes
 * the existing row while keeping the scanner open. Confirm is disabled until
 * the session is non-empty; fecha/hora are never edited — the record always
 * gets the current timestamp, computed at submit time.
 */
export default function CargaPage() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [operacion, setOperacion] = useState<OperacionId>('recargar');
  // Authoritative in-session dedupe set, updated synchronously in onDecode so a
  // repeated scan can never double-count even across stale closures.
  const scannedIdsRef = useRef<Set<string>>(new Set());
  const [noClient, setNoClient] = useState<NoClient | null>(null);
  // Id of the session row currently showing the transient duplicate-scan ring.
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Manual code entry (camera-less PC fallback): typed BOT code + inline error.
  const [codigoManual, setCodigoManual] = useState('');
  const [errorManual, setErrorManual] = useState<string | null>(null);

  // `registrarOperacion` takes a plain input object, but `useActionState` needs
  // a (prevState, payload) action. The ids and operation are read from React
  // state in the action closure: `useActionState` dispatches the LATEST action
  // on submit, so this always reflects the current session without a stale
  // closure. Fecha/hora are the record's timestamp: computed fresh at submit
  // time, never edited by the operator.
  const [state, formAction, pending] = useActionState<CargaState | null>(
    async () => {
      const ahora = new Date();
      return registrarOperacion({
        botellonIds: items.map((i) => i.id),
        operacion,
        fecha: formatFecha(ahora),
        hora: formatHora(ahora),
      });
    },
    null
  );

  /**
   * Shared accumulation for scanned AND manually typed botellones: op-scoped
   * no-client block, in-session dedupe (beep + flash), then append with the
   * resolved client display name. Manual entry reuses this exact path so both
   * flows keep identical duplicate-flash and no-client-overlay behavior.
   */
  async function acumularBotellon(botellon: {
    id: string;
    codigo: string;
    cliente_id: string | null;
    estado: string | null;
  }): Promise<void> {
    // Op-scoped no-client: only operations that require a client (recargar)
    // block on a clientless botellon; pure ops accumulate it.
    if (OPERACIONES[operacion].requiresCliente && !botellon.cliente_id) {
      setNoClient({ id: botellon.id, codigo: botellon.codigo });
      return;
    }

    // In-session dedupe: ignore a code already accumulated. The ref set is
    // updated synchronously, so it is authoritative even when this closure
    // is stale (rapid successive scans see the old `items` array). A
    // duplicate beeps and rings the existing row; the scanner stays open.
    if (scannedIdsRef.current.has(botellon.id)) {
      playBeep();
      setFlashId(botellon.id);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlashId(null), 700);
      return;
    }
    scannedIdsRef.current.add(botellon.id);

    // `getBotellonByCodigo` is public-safe and carries no client PII, so the
    // authenticated batch page resolves the owner name itself for display.
    const cliente = botellon.cliente_id
      ? await getCliente(botellon.cliente_id)
      : null;

    // A valid code clears any stale error overlay from a previous attempt.
    setDecodeError(null);
    setItems((prev) => [
      ...prev,
      {
        id: botellon.id,
        codigo: botellon.codigo,
        cliente: botellon.cliente_id,
        clienteNombre: cliente?.nombre ?? undefined,
        estado: botellon.estado ?? undefined,
      },
    ]);
  }

  const { videoRef, cameraError, decodeError, setDecodeError, stop } =
    useQrScanner({
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

        await acumularBotellon(botellon);
        // Keep the failure outcome after accumulation: the hook treats it as
        // "decode consumed" and resumes scanning for the next botellon.
        return { outcome: 'failure' };
      },
    });

  // Release the camera stream once the batch succeeds: the <video> is removed
  // by the success screen, so without this the getUserMedia track (camera LED)
  // would stay active. stop() is idempotent.
  useEffect(() => {
    if (state?.success) stop();
  }, [state?.success, stop]);

  // Clear the pending flash timeout on unmount.
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const canConfirm = items.length > 0;

  const clientIdFor = (botellonId: string) =>
    items.find((i) => i.id === botellonId)?.cliente ?? null;

  /**
   * Manual entry submit: resolve a typed BOT code (or bare code) and run it
   * through the same accumulation path as a scan. Unknown codes surface an
   * inline error; empty submits are no-ops.
   */
  async function manejarIngresoManual() {
    const codigo = codigoManual.trim();
    if (codigo === '') return;
    const botellon = await getBotellonByCodigo(codigo);
    if (!botellon) {
      setErrorManual('Botellón no encontrado');
      return;
    }
    setErrorManual(null);
    setCodigoManual('');
    await acumularBotellon(botellon);
  }

  const op = OPERACIONES[operacion];

  // Success screen: count, per-item ok list (REC# only for ops that create a
  // REC — i.e. recargar), premios, loyaltyWarning, Ver ficha.
  if (state?.success) {
    const okItems = state.items.filter((i) => i.ok);
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="rounded-2xl bg-green-50 p-6 text-center dark:bg-green-950">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600 dark:text-green-400" />
          <h1 className="mt-2 text-lg font-semibold text-green-900 dark:text-green-200">
            Carga registrada
          </h1>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            {okItems.length} botellones → {ESTADO_LABELS[op.target]}
          </p>
        </div>

        <ul className="mt-4 divide-y divide-zinc-200 rounded-lg border dark:divide-zinc-800 dark:border-zinc-700">
          {state.items.map((item) => {
            if (!item.ok) return null;
            const clienteId = clientIdFor(item.botellonId);
            return (
              <li
                key={item.botellonId}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  {op.createsRec ? (
                    <p className="font-mono text-sm font-medium">
                      {item.numeroRegistro}
                    </p>
                  ) : (
                    <p className="font-mono text-sm font-medium">
                      {item.codigo}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500">{item.codigo}</p>
                </div>
                {clienteId && (
                  <Link
                    href={`/clientes/${clienteId}`}
                    className="text-sm text-zinc-600 hover:underline"
                  >
                    Ver ficha
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {op.createsRec && state.premios && state.premios.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Premios generados
            </p>
            <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              {state.premios.map((p) => (
                <li key={p.id}>Nivel {p.nivel}</li>
              ))}
            </ul>
          </div>
        )}

        {op.createsRec && state.loyaltyWarning && (
          <p className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {state.loyaltyWarning}
          </p>
        )}
      </div>
    );
  }

  const activeCameraError = cameraError;
  const activeDecodeError = decodeError;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Carga de botellones
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Escanea los QR de los botellones, elige la operación y confirma.
      </p>

      {/* Operation selector (segmented control, Recargar default). */}
      <div
        role="group"
        aria-label="Operación"
        className="mt-4 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900"
      >
        {(Object.keys(OPERACION_LABELS) as OperacionId[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={operacion === id}
            onClick={() => setOperacion(id)}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              operacion === id
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800'
            )}
          >
            {OPERACION_LABELS[id]}
          </button>
        ))}
      </div>

      {/* Camera */}
      <div className="relative mt-4 aspect-square overflow-hidden rounded-2xl bg-black">
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
        {!activeCameraError && noClient && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-6 text-center">
            <p className="text-sm font-semibold text-white">
              Sin cliente asignado
            </p>
            <p className="mt-1 text-sm text-zinc-300">{noClient.codigo}</p>
            <Link
              href={`/botellones/${noClient.id}`}
              className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900"
            >
              Asignar cliente
            </Link>
            <button
              type="button"
              onClick={() => setNoClient(null)}
              className="mt-2 text-sm text-zinc-300 hover:text-white"
            >
              Continuar escaneando
            </button>
          </div>
        )}
        {!activeCameraError && !noClient && activeDecodeError && (
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
          block so the input never overlaps the <video> element. */}
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
          <input
            id="carga-manual-codigo"
            type="text"
            placeholder="BOT-00000"
            value={codigoManual}
            onChange={(e) => setCodigoManual(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={codigoManual.trim() === '' || pending}
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Agregar a la sesión
          </button>
        </div>
        {errorManual && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errorManual}
          </p>
        )}
      </form>

      {/* Manual-entry no-client feedback (camera-less PC): the video overlay
          only renders when the camera is available, so a manual entry that
          hits a clientless botellon must surface inline here. */}
      {noClient && activeCameraError ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Sin cliente asignado
          </p>
          <p className="mt-0.5 font-mono text-sm text-amber-700 dark:text-amber-300">
            {noClient.codigo}
          </p>
          <div className="mt-2 flex items-center gap-4">
            <Link
              href={`/botellones/${noClient.id}`}
              className="text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
            >
              Asignar cliente
            </Link>
            <button
              type="button"
              onClick={() => setNoClient(null)}
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      {/* Session items */}
      <div className="mt-4">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Sesión ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-400">
            Aún no se escanearon botellones.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border dark:divide-zinc-800 dark:border-zinc-700">
            {items.map((item) => {
              const valid = esTransicionValida(
                (item.estado as Estado) ?? 'entregado',
                operacion
              );
              return (
                <li
                  key={item.id}
                  data-testid={`session-row-${item.id}`}
                  data-flash={flashId === item.id ? 'true' : undefined}
                  className={cn(
                    'flex items-center justify-between px-4 py-3',
                    flashId === item.id && 'ring-2 ring-amber-400'
                  )}
                >
                  <div>
                    <span className="font-mono text-sm">{item.codigo}</span>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {item.clienteNombre || item.cliente}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      data-testid={`transition-badge-${item.id}`}
                      data-valid={valid ? 'true' : 'false'}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        valid
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : BADGE_INVALID
                      )}
                    >
                      {valid
                        ? ESTADO_LABELS[op.target]
                        : ESTADO_LABELS[item.estado ?? ''] ?? item.estado}
                    </span>
                    {item.cliente && (
                      <Link
                        href={`/clientes/${item.cliente}`}
                        className="text-sm text-zinc-600 hover:underline"
                      >
                        Ver ficha
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Server validation error */}
      {state && !state.success && state.error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </div>
      )}

      {/* Per-item results after a non-successful attempt */}
      {state && !state.success && state.items.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-200 rounded-lg border dark:divide-zinc-800 dark:border-zinc-700">
          {state.items.map((item) => {
            const clienteId = clientIdFor(item.botellonId);
            return (
              <li
                key={item.botellonId}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="font-mono text-sm">{item.codigo}</p>
                  <p className="text-xs text-zinc-500">
                    {item.ok
                      ? op.createsRec
                        ? `Registrado: ${item.numeroRegistro}`
                        : 'Registrado'
                      : `Rechazado: ${item.reason}`}
                  </p>
                </div>
                {!item.ok && item.reason === 'sin-cliente' && (
                  <Link
                    href={`/botellones/${item.botellonId}`}
                    className="text-sm text-zinc-600 hover:underline"
                  >
                    Asignar cliente
                  </Link>
                )}
                {item.ok && clienteId && (
                  <Link
                    href={`/clientes/${clienteId}`}
                    className="text-sm text-zinc-600 hover:underline"
                  >
                    Ver ficha
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Confirm */}
      <form action={formAction} className="mt-6">
        <button
          type="submit"
          disabled={!canConfirm || pending}
          className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Confirmando…' : 'Confirmar carga'}
        </button>
      </form>
    </div>
  );
}
