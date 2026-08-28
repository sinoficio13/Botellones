'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, X } from 'lucide-react';
import { getBotellonByCodigo } from '@/lib/db/botellones';
import { getCliente } from '@/lib/db/clientes';
import { registrarOperacion, type CargaState } from '@/lib/db/cargas';
import {
  ESTADO_LABELS,
  OPERACIONES,
  esTransicionValida,
  type Estado,
  type OperacionId,
} from '@/lib/utils/estados';
import { cn } from '@/lib/utils';

/** A botellon accumulated in the transient in-modal session (mirrors the terminal). */
type SessionItem = {
  id: string;
  codigo: string;
  cliente: string | null;
  clienteNombre?: string;
  estado?: string;
};

/** A botellon with no client assigned that blocked the op-scoped accumulation. */
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

/** Local re-declaration (the terminal keeps its own const; trivial, no refactor). */
const OPERACION_LABELS: Record<OperacionId, string> = {
  recibir: 'Recibir',
  recargar: 'Recargar',
  listo: 'Listo',
};

/** Red badge for an invalid (rejected) transition — explicit constant (no `danado` key). */
const BADGE_INVALID = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';

/** Primary flat button classes (φ-consistent: rounded-lg, one-step darker hover). */
const BTN_PRIMARY =
  'w-full rounded-lg bg-marca px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-marca/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-fill-disabled disabled:text-text-disabled';

/** Secondary flat button classes (surface + border, one-step hover darkening). */
const BTN_SECONDARY =
  'w-full rounded-lg border border-border-strong bg-surface-1 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/60 dark:hover:bg-zinc-800';

/** Input classes for the manual code entry field. */
const INPUT_CLS =
  'rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-text-primary';

/**
 * ModalRecibirBotellon — the camera-less batch terminal as a modal over the
 * Central de Operaciones queue (no navigation: the operator keeps working on
 * the dashboard; the queue updates via realtime behind the overlay).
 *
 * Self-contained accumulation (mirror of the terminal's acumularBotellon):
 * op-scoped no-client block, in-session dedupe via a ref Set (duplicate →
 * amber flash, no double-add), client name resolved via getCliente. Same
 * 3-operation selector (default `recibir`), manual code entry, and a
 * useActionState confirm that posts the exact
 * `registrarOperacion({ botellonIds, operacion, fecha, hora })` payload —
 * fecha/hora always record the current moment, computed at submit time.
 *
 * Fixed overlay (scanner-modal pattern): `fixed inset-0 z-[60] bg-black/70`,
 * `max-w-md rounded-2xl`, click-outside + Escape close. Success renders a
 * green card + per-item list + a single "Listo" that closes; a failed attempt
 * shows the server error + per-item reasons with a "Seguir editando" way back.
 * Tokens only (bg-surface-1, border-border-strong, text-text-*); φ spacing.
 */
export function ModalRecibirBotellon({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [operacion, setOperacion] = useState<OperacionId>('recibir');
  // Authoritative in-session dedupe set, updated synchronously in
  // acumularBotellon so a repeated code can never double-count.
  const scannedIdsRef = useRef<Set<string>>(new Set());
  const [noClient, setNoClient] = useState<NoClient | null>(null);
  // Id of the session row currently showing the transient duplicate flash.
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Manual code entry: typed BOT code + inline error.
  const [codigoManual, setCodigoManual] = useState('');
  const [errorManual, setErrorManual] = useState<string | null>(null);
  // Result rendered in-modal. useActionState drives the async submit/pending;
  // the action stores the returned CargaState so "Seguir editando" can reset it.
  const [resultado, setResultado] = useState<CargaState | null>(null);
  const [, formAction, pending] = useActionState<CargaState | null>(
    async () => {
      const ahora = new Date();
      const res = await registrarOperacion({
        botellonIds: items.map((i) => i.id),
        operacion,
        fecha: formatFecha(ahora),
        hora: formatHora(ahora),
      });
      setResultado(res);
      return res;
    },
    null
  );

  // Escape closes the modal (keyboard affordance, same as the scanner modal).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Clear the pending flash timeout on unmount.
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  /**
   * Shared accumulation for manually typed codes: op-scoped no-client block,
   * in-session dedupe (amber flash, no double-add), then append with the
   * resolved client display name.
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

    // In-session dedupe: a code already accumulated flashes its existing row
    // and is not added again. The ref set is authoritative even on stale
    // closures (rapid successive entries).
    if (scannedIdsRef.current.has(botellon.id)) {
      setFlashId(botellon.id);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlashId(null), 700);
      return;
    }
    scannedIdsRef.current.add(botellon.id);

    // `getBotellonByCodigo` is public-safe and carries no client PII, so the
    // modal resolves the owner name itself for display.
    const cliente = botellon.cliente_id ? await getCliente(botellon.cliente_id) : null;

    setErrorManual(null);
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

  /**
   * Manual entry submit: resolve a typed BOT code and run it through the same
   * accumulation path as a terminal scan. Unknown codes surface an inline
   * error; empty submits are no-ops.
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

  const canConfirm = items.length > 0;

  // ── Result bodies ──

  let cuerpo: ReactNode;

  if (resultado?.success) {
    const okItems = resultado.items.filter((i) => i.ok);
    cuerpo = (
      <div className="space-y-4">
        <div className="rounded-2xl bg-green-50 p-6 text-center dark:bg-green-950">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-600 dark:text-green-400" />
          <h3 className="mt-2 text-base font-semibold text-green-900 dark:text-green-200">
            Carga registrada
          </h3>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            {okItems.length} botellones → {ESTADO_LABELS[op.target]}
          </p>
        </div>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-border-strong dark:divide-zinc-800">
          {resultado.items.map((item) => {
            if (!item.ok) return null;
            return (
              <li key={item.botellonId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-mono text-sm font-medium tabular-nums">{item.codigo}</p>
                  {op.createsRec && item.numeroRegistro ? (
                    <p className="mt-0.5 text-xs text-text-muted">{item.numeroRegistro}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={onClose} className={BTN_PRIMARY}>
          Listo
        </button>
      </div>
    );
  } else if (resultado && !resultado.success) {
    cuerpo = (
      <div className="space-y-4">
        {resultado.error ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {resultado.error}
          </div>
        ) : null}
        {resultado.items.length > 0 ? (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-border-strong dark:divide-zinc-800">
            {resultado.items.map((item) => (
              <li key={item.botellonId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-mono text-sm tabular-nums">{item.codigo}</p>
                  <p className="text-xs text-text-muted">
                    {item.ok ? 'Registrado' : `Rechazado: ${item.reason}`}
                  </p>
                </div>
                {!item.ok && item.reason === 'sin-cliente' ? (
                  <Link
                    href={`/botellones/${item.botellonId}`}
                    className="text-sm font-medium text-marca hover:underline"
                  >
                    Asignar cliente
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => setResultado(null)}
          className={BTN_SECONDARY}
        >
          Seguir editando
        </button>
      </div>
    );
  } else {
    cuerpo = (
      <div className="space-y-4">
        {/* Operation selector (segmented control, Recibir default). */}
        <div
          role="group"
          aria-label="Operación"
          className="flex gap-1 rounded-xl border border-border-strong bg-surface-2 p-1"
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
                  ? 'bg-marca text-white'
                  : 'text-text-secondary hover:bg-surface-3'
              )}
            >
              {OPERACION_LABELS[id]}
            </button>
          ))}
        </div>

        {/* Manual code entry — camera-less fallback. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void manejarIngresoManual();
          }}
        >
          <label
            htmlFor="modal-recibir-codigo"
            className="text-sm font-medium text-text-primary"
          >
            ¿Sin cámara? Ingresá el código manualmente
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="modal-recibir-codigo"
              type="text"
              placeholder="BOT-00000"
              value={codigoManual}
              onChange={(e) => setCodigoManual(e.target.value)}
              className={cn('min-w-0 flex-1 font-mono', INPUT_CLS)}
            />
            <button
              type="submit"
              disabled={codigoManual.trim() === '' || pending}
              className="shrink-0 rounded-lg bg-marca px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-marca/90 disabled:cursor-not-allowed disabled:bg-fill-disabled disabled:text-text-disabled"
            >
              Agregar a la sesión
            </button>
          </div>
          {errorManual && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorManual}</p>
          )}
        </form>

        {/* Manual-entry no-client feedback (inline amber block). */}
        {noClient ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Sin cliente asignado
            </p>
            <p className="mt-0.5 font-mono text-sm tabular-nums text-amber-700 dark:text-amber-300">
              {noClient.codigo}
            </p>
            <div className="mt-2 flex items-center gap-4">
              <Link
                href={`/botellones/${noClient.id}`}
                className="text-sm font-medium text-text-primary underline"
              >
                Asignar cliente
              </Link>
              <button
                type="button"
                onClick={() => setNoClient(null)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Descartar
              </button>
            </div>
          </div>
        ) : null}

        {/* Session items */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Sesión ({items.length})
          </h3>
          {items.length === 0 ? (
            <p className="mt-1 text-sm text-text-muted">Aún no se agregaron botellones.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-border-strong dark:divide-zinc-800">
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
                      <span className="font-mono text-sm tabular-nums">{item.codigo}</span>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {item.clienteNombre || item.cliente}
                      </p>
                    </div>
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
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Confirm */}
        <form action={formAction}>
          <button type="submit" disabled={!canConfirm || pending} className={BTN_PRIMARY}>
            {pending ? 'Confirmando…' : 'Confirmar carga'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recibir botellón"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface-1 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-strong px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Recibir botellón</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{cuerpo}</div>
      </div>
    </div>
  );
}