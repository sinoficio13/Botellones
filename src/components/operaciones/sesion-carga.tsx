'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import {
  ESTADO_LABELS,
  OPERACIONES,
  OPERACION_LABELS,
  type OperacionId,
} from '@/lib/utils/estados';
import { destinosPosibles, type ItemSesion } from '@/hooks/useSesionCarga';
import { cn } from '@/lib/utils';

export type SesionCargaProps = {
  items: ItemSesion[];
  flashId: string | null;
  onSetDestino: (id: string, destino: OperacionId | null) => void;
  onQuitar: (id: string) => void;
};

/**
 * SesionCarga — the shared session-row list used by the "Recibir botellón"
 * modal. Each row shows the bottle's CURRENT estado → pre-filled destination:
 *   - 'recarga' rows: a small chooser between 'Listo' and 'En delivery'
 *   - 'listo' rows: a small chooser between 'En delivery' and 'Entregar'
 *   - other actionable rows: the static "Entregado → Recibido" arrow text
 *   - rows with no destination (unknown estados): a muted hint to manage them
 *     in the dashboard
 * A chosen destination that requires a client (recargar / delivery / entregar)
 * on a clientless bottle renders an amber "Sin cliente asignado" warning with
 * "Asignar cliente" and "Crear cliente" links. Every row has a ✕ remove button.
 * Token classes only (φ spacing).
 */
export function SesionCarga({ items, flashId, onSetDestino, onQuitar }: SesionCargaProps) {
  if (items.length === 0) {
    return <p className="mt-1 text-sm text-text-muted">Aún no se agregaron botellones.</p>;
  }

  return (
    <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-border-strong dark:divide-zinc-800">
      {items.map((item) => {
        const posibles = destinosPosibles(item.estado);
        const esRecargaChooser = posibles.length > 1;
        const destinoRequiereCliente =
          item.destino != null && OPERACIONES[item.destino].requiresCliente && !item.cliente;
        return (
          <li
            key={item.id}
            data-testid={`session-row-${item.id}`}
            data-flash={flashId === item.id ? 'true' : undefined}
            className={cn('px-4 py-3', flashId === item.id && 'ring-2 ring-amber-400')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-mono text-sm tabular-nums text-text-primary">
                  {item.codigo}
                </span>
                <p className="mt-0.5 text-xs text-text-muted">
                  {item.clienteNombre || item.cliente}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onQuitar(item.id)}
                aria-label={`Quitar ${item.codigo}`}
                className="shrink-0 rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Destination area: current estado → target (or a hint). */}
            {esRecargaChooser ? (
              <div
                role="group"
                aria-label="Destino"
                className="mt-2 flex gap-1 rounded-lg border border-border-strong bg-surface-2 p-0.5"
              >
                {posibles.map((op) => (
                  <button
                    key={op}
                    type="button"
                    aria-pressed={item.destino === op}
                    onClick={() => onSetDestino(item.id, op)}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      item.destino === op
                        ? 'bg-marca text-white'
                        : 'text-text-secondary hover:bg-surface-3'
                    )}
                  >
                    {OPERACION_LABELS[op]}
                  </button>
                ))}
              </div>
            ) : item.destino ? (
              <p className="mt-2 text-xs text-text-secondary">
                {ESTADO_LABELS[item.estado] ?? item.estado} →{' '}
                {ESTADO_LABELS[OPERACIONES[item.destino].target]}
              </p>
            ) : (
              <p className="mt-2 text-xs text-text-muted">Gestionar en el dashboard</p>
            )}

            {/* A chosen destination that requires a client (recargar/delivery/
                entregar) on a clientless bottle is doomed server-side — warn up
                front, offer to assign an existing client or create a new one. */}
            {destinoRequiereCliente ? (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                  Sin cliente asignado
                </p>
                <span className="flex items-center gap-3">
                  <Link
                    href={`/botellones/${item.id}`}
                    className="text-xs font-medium text-text-primary underline"
                  >
                    Asignar cliente
                  </Link>
                  <Link
                    href={`/clientes/nuevo?botellon_id=${item.id}`}
                    className="text-xs font-medium text-text-primary underline"
                  >
                    Crear cliente
                  </Link>
                </span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}