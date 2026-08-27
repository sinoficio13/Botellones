'use client';

import { cn } from '@/lib/utils';
import { ESTADO_LABELS } from '@/lib/utils/estados';
import { ESTADOS_OPERATIVOS, type DestinoAccion, type EstadoOperativo, type PorEstado } from '@/hooks/useColaOperaciones';
import { ListaSkeleton } from '@/components/operaciones/lista-skeleton';
import { EmptyState } from '@/components/operaciones/empty-state';
import { DESTINO_ACCION } from '@/components/operaciones/grupo-card';
import { GrupoCardKanban } from '@/components/operaciones/grupo-card-kanban';

export type KanbanDesktopProps = {
  porEstado: PorEstado;
  cargando: boolean;
  /** = fase-3 `mover` (DestinoAccion includes 'entregado' — Entregar stays button-only). */
  onMover: (ids: string[], destino: DestinoAccion) => void | Promise<unknown>;
};

/** Estado → 2px dot token (D6 — component-local presentation map, codebase convention). */
const ESTADO_DOT: Record<EstadoOperativo, string> = {
  recibido: 'bg-estado-recibido',
  recarga: 'bg-estado-recarga',
  listo: 'bg-estado-listo',
  delivery: 'bg-estado-delivery',
};

/** Per-estado header/placeholder subtitle (D8 — short state subtitle, not the action copy). */
const SUBTITULO_ESTADO: Record<EstadoOperativo, string> = {
  recibido: 'Esperando lavado',
  recarga: 'Llenando ahora',
  listo: 'Listos para salir',
  delivery: 'En camino al cliente',
};

/**
 * KanbanDesktop — the ≥1024px 4-column queue (REQ-22, D1). One column per
 * estado (same FIFO `porEstado` groups from useColaOperaciones, oldest first),
 * sticky header (2px --estado-* dot + label + group counter + subtitle), body
 * = ListaSkeleton while loading (REQ-21: skeleton, never a spinner, D11),
 * compact whole-group cards (REQ-23), or a dashed 120px "Vacío" placeholder
 * (REQ-24, D9) that keeps the grid intact.
 *
 * Columns use role="group" (D7) — never region — so jsdom's all-branches
 * render can't collide with the tablet sections' getByRole('region').
 * Drag & drop is Slice B (PR-B): the handlers below are inert stubs.
 */
export function KanbanDesktop({ porEstado, cargando, onMover }: KanbanDesktopProps) {
  return (
    <>
      {ESTADOS_OPERATIVOS.map((estado) => {
        const grupos = porEstado[estado];
        return (
          <div
            key={estado}
            role="group"
            aria-label={`${ESTADO_LABELS[estado]} — ${SUBTITULO_ESTADO[estado]}`}
            data-testid="kanban-columna"
            className="flex min-w-0 flex-col gap-2"
            // Slice B (PR-B): drag & drop handlers wire here (D10) — inert stubs.
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => undefined}
          >
            <div className="sticky top-0 z-10 bg-surface-1 py-1">
              <div className="flex items-center gap-1.5">
                <span aria-hidden className={cn('h-0.5 w-2 rounded-full', ESTADO_DOT[estado])} />
                <h3 className="text-sm font-semibold text-text-primary">
                  {ESTADO_LABELS[estado]}{' '}
                  <span className="text-text-muted">{grupos.length}</span>
                </h3>
              </div>
              <p className="text-xs text-text-muted">{SUBTITULO_ESTADO[estado]}</p>
            </div>

            {cargando ? (
              <ListaSkeleton cantidad={1} />
            ) : grupos.length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-border-strong p-3">
                <EmptyState title="Vacío" description={SUBTITULO_ESTADO[estado]} />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {grupos.map((grupo) => (
                  <GrupoCardKanban
                    key={grupo.cliente_id}
                    grupo={grupo}
                    estado={estado}
                    onAccion={(ids) => onMover(ids, DESTINO_ACCION[estado])}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}