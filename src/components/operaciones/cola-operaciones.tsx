'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ESTADO_LABELS } from '@/lib/utils/estados';
import {
  useColaOperaciones,
  ESTADOS_OPERATIVOS,
  type EstadoOperativo,
  type GrupoCola,
} from '@/hooks/useColaOperaciones';
import { TabsEstados } from '@/components/operaciones/tabs-estados';
import { BarraContexto } from '@/components/operaciones/barra-contexto';
import { Buscador } from '@/components/operaciones/buscador';
import { ListaSkeleton } from '@/components/operaciones/lista-skeleton';
import { GrupoCard, DESTINO_ACCION } from '@/components/operaciones/grupo-card';
import { KanbanDesktop } from '@/components/operaciones/kanban-desktop';
import { VacioPorEstado, COPIA_VACIO_TOTAL } from '@/components/operaciones/copy-vacios';
import { EmptyState } from '@/components/operaciones/empty-state';
import { ActionButton } from '@/components/operaciones/action-button';
import { ToastHost } from '@/components/operaciones/toast';
import { ScannerModal } from '@/components/scanner/scanner-modal';

/**
 * ColaOperaciones — screen shell of the Central de Operaciones queue
 * (REQ-COS-21). Composes the Slice A–D building blocks:
 *
 *  - `useColaOperaciones`: fetch → per-estado groups + totals + mover/undo
 *  - `TabsEstados` + `BarraContexto` + `Buscador` (mobile header)
 *  - per-tab content: `ListaSkeleton` while loading (never a spinner),
 *    `VacioPorEstado` per-tab empty copy, or `GrupoCard` list
 *  - tablet 768–1023 (design D9, CSS-only): tabs `md:hidden`, a 2-column grid
 *    of sections per estado with sticky headers — no JS breakpoint
 *  - first-use total-empty with [📷 Escanear] → ScannerModal and
 *    [Cargar manual] → `/recargas/carga`; fetch-error empty state (R4-004)
 *    distinct from empty with Reintentar
 *  - `ToastHost` mounted here (module-level toast store; no layout mounts it)
 *
 * UI copy Spanish; tokens only.
 */
export function ColaOperaciones() {
  const { cargando, error, porEstado, totales, mover, reintentar } = useColaOperaciones();
  const [tab, setTab] = useState<EstadoOperativo>('recibido');
  const [scannerAbierto, setScannerAbierto] = useState(false);
  const router = useRouter();

  const contadores: Record<EstadoOperativo, number> = {
    recibido: porEstado.recibido.length,
    recarga: porEstado.recarga.length,
    listo: porEstado.listo.length,
    delivery: porEstado.delivery.length,
  };

  const vacioTotal = !cargando && !error && totales.botellones === 0;

  /** Per-tab empty actions (Slice A wiring): recibido opens the scanner; the
   * "Ver X" hints switch tabs on mobile (tablet shows every section at once,
   * where switching the hidden tab is a harmless no-op). */
  function accionVacio(estado: EstadoOperativo): () => void {
    if (estado === 'recibido') return () => setScannerAbierto(true);
    const destino: Record<EstadoOperativo, EstadoOperativo> = {
      recibido: 'recibido',
      recarga: 'recibido',
      listo: 'recarga',
      delivery: 'listo',
    };
    return () => setTab(destino[estado]);
  }

  function renderGrupos(estado: EstadoOperativo, grupos: GrupoCola[]) {
    return grupos.map((grupo) => (
      <GrupoCard
        key={grupo.cliente_id}
        grupo={grupo}
        estado={estado}
        onAccion={(ids) => mover(ids, DESTINO_ACCION[estado])}
      />
    ));
  }

  return (
    <div>
      <ToastHost />

      {error ? (
        <div className="px-4 py-8">
          <EmptyState
            title="No se pudo cargar la cola"
            description={error}
            action={
              <button
                type="button"
                onClick={reintentar}
                className="mt-2 text-sm font-medium text-marca"
              >
                Reintentar
              </button>
            }
          />
        </div>
      ) : vacioTotal ? (
        <div className="px-4 py-8">
          <EmptyState
            title={COPIA_VACIO_TOTAL.titulo}
            description={COPIA_VACIO_TOTAL.descripcion}
            action={
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-3">
                <ActionButton onClick={() => setScannerAbierto(true)}>
                  📷 Escanear
                </ActionButton>
                <button
                  type="button"
                  onClick={() => router.push('/recargas/carga')}
                  className="min-h-11 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-primary"
                >
                  Cargar manual
                </button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="px-4 pt-3">
            <BarraContexto clientes={totales.clientes} botellones={totales.botellones} />
          </div>
          <Buscador />

          {/* Mobile: tabs + active-tab list (tabs hidden from md, D9). */}
          <div className="md:hidden">
            <TabsEstados activo={tab} onCambio={setTab} contadores={contadores} />
          </div>
          <div data-testid="cola-movil" className="space-y-3 px-4 py-4 md:hidden">
            {cargando ? (
              <ListaSkeleton cantidad={3} />
            ) : porEstado[tab].length === 0 ? (
              <VacioPorEstado estado={tab} onAccion={accionVacio(tab)} />
            ) : (
              renderGrupos(tab, porEstado[tab])
            )}
          </div>

          {/* Tablet 768–1023 (design D9, CSS-only): 2-col sections per estado
              with sticky headers, NO tabs (spec §6.2). Hidden ≥1024 (MOD-21:
              the leak fix — previously `md:grid` applied at every width ≥768). */}
          <div
            data-testid="cola-tablet"
            className="hidden gap-4 px-4 py-4 md:grid md:grid-cols-2 lg:hidden"
          >
            {ESTADOS_OPERATIVOS.map((estado) => (
              <section
                key={estado}
                aria-label={ESTADO_LABELS[estado]}
                className="flex flex-col gap-2"
              >
                <h2 className="sticky top-0 z-10 bg-surface-1 py-1 text-sm font-semibold text-text-primary">
                  {ESTADO_LABELS[estado]}{' '}
                  <span className="text-text-muted">{porEstado[estado].length}</span>
                </h2>
                {cargando ? (
                  <ListaSkeleton cantidad={2} />
                ) : porEstado[estado].length === 0 ? (
                  <VacioPorEstado estado={estado} onAccion={accionVacio(estado)} />
                ) : (
                  renderGrupos(estado, porEstado[estado])
                )}
              </section>
            ))}
          </div>

          {/* Desktop ≥1024 (REQ-22): 4-col kanban grid, CSS-only breakpoint.
              Same porEstado FIFO data; mobile/tablet branches above untouched. */}
          <div
            data-testid="cola-kanban"
            className="hidden gap-4 px-4 py-4 lg:grid lg:grid-cols-4"
          >
            <KanbanDesktop porEstado={porEstado} cargando={cargando} onMover={mover} />
          </div>
        </>
      )}

      {scannerAbierto ? <ScannerModal onClose={() => setScannerAbierto(false)} /> : null}
    </div>
  );
}