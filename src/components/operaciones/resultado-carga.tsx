'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import type { CargaState } from '@/lib/db/cargas';
import type { ItemSesion } from '@/hooks/useSesionCarga';

/** Primary flat button classes (φ-consistent: rounded-lg, one-step darker hover). */
const BTN_PRIMARY =
  'w-full rounded-lg bg-marca px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-marca/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-fill-disabled disabled:text-text-disabled';

/** Secondary flat button classes (surface + border, one-step hover darkening). */
const BTN_SECONDARY =
  'w-full rounded-lg border border-border-strong bg-surface-1 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/60 dark:hover:bg-zinc-800';

export type ResultadoCargaProps = {
  /** One CargaState per destino group (aggregated by `useSesionCarga.confirmar`). */
  resultado: CargaState[];
  /** Live session rows (for the "Ver ficha" client lookup). */
  items: ItemSesion[];
  /** Success action: terminal resets the batch, modal closes. */
  onListo: () => void;
  /** Failure action: hide the result and keep the session editable. */
  onSeguirEditando: () => void;
};

/**
 * ResultadoCarga — shared per-row outcome list for a completed batch, rendered
 * by both the /recargas/carga terminal and the "Recibir botellón" modal.
 * Every submitted row shows success (REC# when the op creates one) or its
 * rejection reason; "Sin cliente" rejections carry an "Asignar cliente" link.
 * The header is a green "Carga registrada" card when every group succeeded, or
 * the server error(s) otherwise, and the footer is "Listo" / "Seguir editando".
 */
export function ResultadoCarga({
  resultado,
  items,
  onListo,
  onSeguirEditando,
}: ResultadoCargaProps) {
  const todoOk = resultado.length > 0 && resultado.every((r) => r.success);
  const filas = resultado.flatMap((r) => r.items);
  const premios = resultado.flatMap((r) => r.premios ?? []);
  const avisos = resultado.flatMap((r) => (r.loyaltyWarning ? [r.loyaltyWarning] : []));
  const errores = resultado.flatMap((r) => (r.error ? [r.error] : []));
  const clienteIdFor = (botellonId: string) =>
    items.find((i) => i.id === botellonId)?.cliente ?? null;

  return (
    <div className="space-y-4">
      {todoOk ? (
        <div className="rounded-2xl bg-green-50 p-6 text-center dark:bg-green-950">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600 dark:text-green-400" />
          <h2 className="mt-2 text-base font-semibold text-green-900 dark:text-green-200">
            Carga registrada
          </h2>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            {filas.filter((i) => i.ok).length} botellones registrados
          </p>
        </div>
      ) : (
        errores.map((err) => (
          <div
            key={err}
            className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300"
          >
            {err}
          </div>
        ))
      )}

      <ul className="divide-y divide-zinc-200 rounded-lg border border-border-strong dark:divide-zinc-800">
        {filas.map((item) => {
          const clienteId = clienteIdFor(item.botellonId);
          return (
            <li key={item.botellonId} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-mono text-sm tabular-nums text-text-primary">{item.codigo}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {item.ok
                    ? item.numeroRegistro
                      ? `Registrado: ${item.numeroRegistro}`
                      : 'Registrado'
                    : `Rechazado: ${item.reason}`}
                </p>
              </div>
              {!item.ok && item.reason === 'sin-cliente' ? (
                <Link
                  href={`/botellones/${item.botellonId}`}
                  className="text-sm font-medium text-marca hover:underline"
                >
                  Asignar cliente
                </Link>
              ) : item.ok && clienteId ? (
                <Link
                  href={`/clientes/${clienteId}`}
                  className="text-sm font-medium text-marca hover:underline"
                >
                  Ver ficha
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {premios.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Premios generados
          </p>
          <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            {premios.map((p) => (
              <li key={p.id}>Nivel {p.nivel}</li>
            ))}
          </ul>
        </div>
      )}
      {avisos.map((aviso) => (
        <p
          key={aviso}
          className="rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {aviso}
        </p>
      ))}

      {todoOk ? (
        <button type="button" onClick={onListo} className={BTN_PRIMARY}>
          Listo
        </button>
      ) : (
        <button type="button" onClick={onSeguirEditando} className={BTN_SECONDARY}>
          Seguir editando
        </button>
      )}
    </div>
  );
}