'use client';

import { useEffect, useState } from 'react';
import { ESTADO_LABELS } from '@/lib/utils/estados';
import {
  useColaOperaciones,
  ESTADOS_OPERATIVOS,
  type EstadoOperativo,
  type GrupoCola,
} from '@/hooks/useColaOperaciones';
import { TabsEstados } from '@/components/operaciones/tabs-estados';
import { BarraContexto } from '@/components/operaciones/barra-contexto';
import { ListaSkeleton } from '@/components/operaciones/lista-skeleton';
import { GrupoCard, DESTINO_ACCION } from '@/components/operaciones/grupo-card';
import { KanbanDesktop } from '@/components/operaciones/kanban-desktop';
import { ChipRealtime } from '@/components/operaciones/chip-realtime';
import { SheetWhatsApp } from '@/components/operaciones/sheet-whatsapp';
import { FichaCliente } from '@/components/operaciones/ficha-cliente';
import { VacioPorEstado, COPIA_VACIO_TOTAL } from '@/components/operaciones/copy-vacios';
import { EmptyState } from '@/components/operaciones/empty-state';
import { ActionButton } from '@/components/operaciones/action-button';
import { ToastHost } from '@/components/operaciones/toast';
import { showToast } from '@/components/operaciones/toast';
import { ScannerModal } from '@/components/scanner/scanner-modal';
import { ModalRecibirBotellon } from '@/components/operaciones/modal-recibir-botellon';

/** Debounce de fin de scroll (REQ-COS-27 D3): scrolleando se limpia 150ms después del último evento. */
const FIN_SCROLL_MS = 150;

/**
 * ColaOperaciones — screen shell of the Central de Operaciones queue
 * (REQ-COS-21). Composes the Slice A–D building blocks:
 *
 *  - `useColaOperaciones`: fetch → per-estado groups + totals + mover/undo
 *  - `TabsEstados` + `BarraContexto` (mobile header)
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
  const [tab, setTab] = useState<EstadoOperativo>('recibido');
  const [scannerAbierto, setScannerAbierto] = useState(false);
  // Modal "Recibir botellón": the camera-less batch terminal over the queue so
  // the operator keeps working on the dashboard (opens in place, no navigation).
  const [modalRecibir, setModalRecibir] = useState(false);
  // D8: WhatsApp sheet state (REQ-COS-28) — {grupo, estado} while open, null
  // when closed (controlled; only one sheet at a time).
  const [sheetWhatsApp, setSheetWhatsApp] = useState<{
    grupo: GrupoCola;
    estado: EstadoOperativo;
  } | null>(null);
  // D8: client ficha sheet state (REQ-COS-29) — same controlled pattern; the
  // ficha's WhatsApp action swaps to the WhatsApp sheet (only one open).
  const [sheetFicha, setSheetFicha] = useState<{
    grupo: GrupoCola;
    estado: EstadoOperativo;
  } | null>(null);

  const {
    cargando,
    error,
    porEstado,
    porEstadoVisibles,
    totales,
    mover,
    reintentar,
    pendientes,
    aplicarPendientes,
    entrando,
    setScrolleando,
  } = useColaOperaciones({ tab });

  // REQ-COS-27 D3: mientras el operador scrollea, los cambios realtime se
  // encolan detrás del chip (nunca reordenar bajo el dedo); 150ms tras el
  // último scroll el gate vuelve a aplicar directo.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onScroll() {
      setScrolleando(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setScrolleando(false), FIN_SCROLL_MS);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [setScrolleando]);

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

  /**
   * REQ-COS-28 S4 (D7): the WhatsApp tap ALWAYS lands here — the card fires it
   * regardless of phone. A client without a phone gets the toast and the sheet
   * stays closed; with a phone the sheet opens pre-loaded for this estado.
   */
  function abrirWhatsApp(grupo: GrupoCola, estado: EstadoOperativo) {
    const cliente = grupo.botellones[0]?.clientes;
    if (!cliente?.whatsapp) {
      showToast({ message: 'Este cliente no tiene teléfono cargado', tone: 'error' });
      return;
    }
    setSheetWhatsApp({ grupo, estado });
  }

  /**
   * REQ-COS-29 (D8): the ficha's WhatsApp action swaps sheets — the ficha
   * closes and the shared WhatsApp sheet opens pre-loaded for this client.
   */
  function abrirFichaWhatsApp(grupo: GrupoCola, estado: EstadoOperativo) {
    setSheetFicha(null);
    abrirWhatsApp(grupo, estado);
  }

  /**
   * REQ-COS-29: name tap opens the client ficha. Queue cards are always
   * client-owned, but the type allows null (stock groups) — guard so the
   * ficha never fetches with a null cliente_id.
   */
  function abrirFicha(grupo: GrupoCola, estado: EstadoOperativo) {
    if (!grupo.cliente_id) return;
    setSheetFicha({ grupo, estado });
  }

  function renderGrupos(estado: EstadoOperativo, grupos: GrupoCola[]) {
    return grupos.map((grupo) => (
      <GrupoCard
        key={grupo.cliente_id}
        grupo={grupo}
        estado={estado}
        entrando={entrando.has(grupo.cliente_id ?? '')}
        onAccion={(ids) => mover(ids, DESTINO_ACCION[estado])}
        onEntregar={estado === 'listo' ? (ids) => mover(ids, 'entregado') : undefined}
        onWhatsApp={() => abrirWhatsApp(grupo, estado)}
        onAbrirFicha={() => abrirFicha(grupo, estado)}
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
                <ActionButton onClick={() => setModalRecibir(true)}>
                  Recibir botellón
                </ActionButton>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <BarraContexto clientes={totales.clientes} botellones={totales.botellones} />
            {/* Persistent manual entry on desktop (camera-less PC): opens the
                batch modal OVER the queue so the operator keeps working on the
                dashboard. Mobile already reaches manual entry via the nav QR. */}
            <button
              type="button"
              onClick={() => setModalRecibir(true)}
              className="hidden shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-1 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca/60 lg:inline-flex dark:hover:bg-zinc-800"
            >
              Recibir botellón
            </button>
          </div>

          {/* Mobile: tabs + active-tab list (tabs hidden from md, D9). */}
          <div className="md:hidden">
            <TabsEstados activo={tab} onCambio={setTab} contadores={contadores} />
          </div>
          {/* Chip flotante "↑ N botellones nuevos" bajo las tabs (REQ-COS-27):
              sticky, visible en todos los layouts; tap aplica los cambios
              encolados. No renderiza nada cuando no hay pendientes. */}
          <ChipRealtime cantidad={pendientes} onAplicar={aplicarPendientes} />
          <div data-testid="cola-movil" className="space-y-3 px-4 py-4 md:hidden">
            {cargando ? (
              <ListaSkeleton cantidad={3} />
            ) : porEstadoVisibles[tab].length === 0 ? (
              <VacioPorEstado estado={tab} onAccion={accionVacio(tab)} />
            ) : (
              renderGrupos(tab, porEstadoVisibles[tab])
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
                ) : porEstadoVisibles[estado].length === 0 ? (
                  <VacioPorEstado estado={estado} onAccion={accionVacio(estado)} />
                ) : (
                  renderGrupos(estado, porEstadoVisibles[estado])
                )}
              </section>
            ))}
          </div>

          {/* Desktop ≥1024 (REQ-22): 4-col kanban grid, CSS-only breakpoint.
              Same porEstado FIFO data; mobile/tablet branches above untouched. */}
          <div
            data-testid="cola-kanban"
            className="hidden gap-3 px-4 py-4 lg:grid lg:grid-cols-4"
          >
            <KanbanDesktop
              porEstado={porEstadoVisibles}
              cargando={cargando}
              onMover={mover}
              onWhatsApp={abrirWhatsApp}
              onAbrirFicha={abrirFicha}
            />
          </div>
        </>
      )}

      {scannerAbierto ? <ScannerModal onClose={() => setScannerAbierto(false)} /> : null}

      {modalRecibir ? (
        <ModalRecibirBotellon onClose={() => setModalRecibir(false)} />
      ) : null}

      {sheetWhatsApp ? (
        <SheetWhatsApp
          grupo={sheetWhatsApp.grupo}
          estado={sheetWhatsApp.estado}
          onClose={() => setSheetWhatsApp(null)}
        />
      ) : null}

      {sheetFicha ? (
        <FichaCliente
          // abrirFicha guards null cliente_id before setting the state, so
          // the ficha only ever opens for a client-owned group.
          clienteId={sheetFicha.grupo.cliente_id!}
          onClose={() => setSheetFicha(null)}
          onWhatsApp={() => abrirFichaWhatsApp(sheetFicha.grupo, sheetFicha.estado)}
        />
      ) : null}
    </div>
  );
}