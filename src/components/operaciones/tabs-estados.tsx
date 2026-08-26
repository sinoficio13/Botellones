'use client';

import { cn } from '@/lib/utils';
import { ESTADO_LABELS } from '@/lib/utils/estados';
import { ESTADOS_OPERATIVOS, type EstadoOperativo } from '@/hooks/useColaOperaciones';

export type TabsEstadosProps = {
  activo: EstadoOperativo;
  onCambio: (estado: EstadoOperativo) => void;
  contadores: Record<EstadoOperativo, number>;
};

/** Estado → 2px underline token (REQ-COS-17: each tab's underline in its own --estado-*). */
const ESTADO_TOKEN: Record<EstadoOperativo, string> = {
  recibido: 'bg-estado-recibido',
  recarga: 'bg-estado-recarga',
  listo: 'bg-estado-listo',
  delivery: 'bg-estado-delivery',
};

/**
 * TabsEstados — 4 estado tabs (REQ-COS-17). role=tablist/tab with
 * aria-selected on the active tab, sticky at the top, per-estado group
 * counters (static this fase — realtime in fase 5), and a 2px underline in
 * the active tab's own --estado-* token. 44px touch targets, tokens only.
 */
export function TabsEstados({ activo, onCambio, contadores }: TabsEstadosProps) {
  return (
    <div
      role="tablist"
      aria-label="Estados de la cola"
      className="sticky top-0 z-10 flex border-b border-border-strong bg-surface-1"
    >
      {ESTADOS_OPERATIVOS.map((estado) => {
        const seleccionado = estado === activo;
        return (
          <button
            key={estado}
            type="button"
            role="tab"
            aria-selected={seleccionado}
            onClick={() => onCambio(estado)}
            className={cn(
              'relative min-h-11 flex-1 px-2 text-sm font-medium transition-colors',
              seleccionado ? 'text-text-primary' : 'text-text-muted'
            )}
          >
            {ESTADO_LABELS[estado]} {contadores[estado]}
            {seleccionado ? (
              <span
                aria-hidden
                className={cn('absolute inset-x-0 bottom-0 h-0.5 rounded-t-full', ESTADO_TOKEN[estado])}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}