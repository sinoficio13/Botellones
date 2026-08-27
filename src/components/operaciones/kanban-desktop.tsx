'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ESTADO_LABELS, getEstadosPermitidos } from '@/lib/utils/estados';
import { ESTADOS_OPERATIVOS, type DestinoAccion, type EstadoOperativo, type GrupoCola, type PorEstado } from '@/hooks/useColaOperaciones';
import { ListaSkeleton } from '@/components/operaciones/lista-skeleton';
import { EmptyState } from '@/components/operaciones/empty-state';
import { DESTINO_ACCION } from '@/components/operaciones/grupo-card';
import { showToast } from '@/components/operaciones/toast';
import { GrupoCardKanban } from '@/components/operaciones/grupo-card-kanban';

export type KanbanDesktopProps = {
  porEstado: PorEstado;
  cargando: boolean;
  /** = fase-3 `mover` (DestinoAccion includes 'entregado' — Entregar stays button-only). */
  onMover: (ids: string[], destino: DestinoAccion) => void | Promise<unknown>;
  /** REQ-COS-28 (PR-B): WhatsApp tap passthrough → shell opens the sheet. */
  onWhatsApp?: (grupo: GrupoCola, estado: EstadoOperativo) => void;
  /** REQ-COS-29 (PR-C): name tap passthrough → shell opens the client ficha. */
  onAbrirFicha?: (grupo: GrupoCola, estado: EstadoOperativo) => void;
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
 * Drag & drop is REQ-25 (Slice B / PR-B): the parent owns the `dragId`
 * fallback state (D10, old-kanban pattern); a card's dragstart reports its
 * ids, the target column's drop resolves dataTransfer || dragId, guards the
 * move client-side via getEstadosPermitidos (D5 — zero mover calls + generic
 * red toast on an invalid drop), and dragend clears the fallback.
 */
export function KanbanDesktop({ porEstado, cargando, onMover, onWhatsApp, onAbrirFicha }: KanbanDesktopProps) {
  // D10: parent-owned dragId — fallback for Firefox's empty dataTransfer.getData.
  const [dragId, setDragId] = useState<string | null>(null);

  /**
   * D4: locate the origin estado of a dragged group by searching `porEstado`
   * (GrupoCola has no estado field). Returns null when the ids are unknown.
   */
  function buscarOrigen(ids: string[]): EstadoOperativo | null {
    for (const estado of ESTADOS_OPERATIVOS) {
      for (const grupo of porEstado[estado]) {
        if (grupo.botellones.some((b) => ids.includes(b.id))) return estado;
      }
    }
    return null;
  }

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
            // REQ-25: dragover must preventDefault to allow the drop; onDrop
            // moves the WHOLE group to this column's estado (guarded).
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData('text/plain') || dragId;
              // Carried fix: the drop CONSUMES the fallback — clear dragId here
              // (not only on dragend) so a stale fallback can't fire a later
              // drop that never had a fresh dragstart (Firefox quirk).
              setDragId(null);
              if (!raw) return;
              const ids = raw.split(',');
              const origen = buscarOrigen(ids);
              if (!origen) return;
              // Same-column drop → no-op (nothing to move, no toast).
              if (origen === estado) return;
              // D5 pre-guard: invalid transition → zero mover calls + generic
              // red toast (locked decision 3), no undo.
              if (!getEstadosPermitidos(origen).includes(estado)) {
                showToast({ message: 'No se pudo mover. Reintentá.', tone: 'error' });
                return;
              }
              onMover(ids, estado);
            }}
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
                    onWhatsApp={() => onWhatsApp?.(grupo, estado)}
                    onAbrirFicha={() => onAbrirFicha?.(grupo, estado)}
                    onDragStart={(idsStr) => setDragId(idsStr)}
                    onDragEnd={() => setDragId(null)}
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