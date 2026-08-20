'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ScanLine } from 'lucide-react';
import { getBotellonByCodigo } from '@/lib/db/botellones';
import { registrarCarga, type CargaState } from '@/lib/db/cargas';
import { parseQrCode } from '@/lib/scanner/parse-qr';
import {
  useQrScanner,
  type QrDecodeOutcome,
} from '@/lib/scanner/use-qr-scanner';

/** A botellon accumulated in the transient client-side session. */
type SessionItem = { id: string; codigo: string; cliente: string };

/** A decoded botellon that has no client assigned, for the overlay. */
type NoClient = { id: string; codigo: string };

/**
 * Batch "carga" page: scan botellon QRs, accumulate them into a session,
 * then confirm ONE uniform recarga for the whole lot via `registrarCarga`.
 *
 * Accumulation is handler-driven (in `onDecode`), never `setState` in an
 * effect. The same code is deduped in-session so a repeated scan cannot
 * double-count. A shared fecha/hora applies to every item, and confirm is
 * disabled until the session is non-empty and both fields are set.
 */
export default function CargaPage() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [noClient, setNoClient] = useState<NoClient | null>(null);

  // `registrarCarga` takes a plain input object, but `useActionState` needs a
  // (prevState, payload) action. The ids, fecha, and hora are read from React
  // state in the action closure: `useActionState` dispatches the LATEST action
  // on submit, so this always reflects the current session without a stale
  // closure. Accumulation itself stays handler-driven in `onDecode`.
  const [state, formAction, pending] = useActionState<CargaState | null>(
    async () =>
      registrarCarga({
        botellonIds: items.map((i) => i.id),
        fecha,
        hora,
      }),
    null
  );

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

      if (!botellon.cliente_id) {
        setNoClient({ id: botellon.id, codigo: botellon.codigo });
        return { outcome: 'failure' };
      }

      // In-session dedupe: ignore a code already accumulated.
      if (items.some((i) => i.id === botellon.id)) {
        return { outcome: 'failure' };
      }

      // A valid decode clears any stale error overlay from a previous scan.
      setDecodeError(null);
      setItems((prev) => [
        ...prev,
        {
          id: botellon.id,
          codigo: botellon.codigo,
          cliente: botellon.cliente_id as string,
        },
      ]);
      return { outcome: 'failure' };
    },
  });

  const canConfirm =
    items.length > 0 && fecha.trim() !== '' && hora.trim() !== '';

  // Release the camera stream once the batch succeeds: the <video> is removed
  // by the success screen, so without this the getUserMedia track (camera LED)
  // would stay active. stop() is idempotent.
  useEffect(() => {
    if (state?.success) stop();
  }, [state?.success, stop]);

  const clientIdFor = (botellonId: string) =>
    items.find((i) => i.id === botellonId)?.cliente;

  // Success screen: count, REC# list, premios, loyaltyWarning, Ver ficha.
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
            {okItems.length} botellones recargados
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
                  <p className="font-mono text-sm font-medium">
                    {item.numeroRegistro}
                  </p>
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

        {state.premios && state.premios.length > 0 && (
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

        {state.loyaltyWarning && (
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
        Escanea los QR de los botellones y confirma una carga única.
      </p>

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
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="font-mono text-sm">{item.codigo}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Shared fecha/hora for the whole batch */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="carga-fecha"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Fecha
          </label>
          <input
            id="carga-fecha"
            name="fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <div>
          <label
            htmlFor="carga-hora"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Hora
          </label>
          <input
            id="carga-hora"
            name="hora"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
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
                      ? `Registrado: ${item.numeroRegistro}`
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
