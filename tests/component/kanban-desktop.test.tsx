import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { KanbanDesktop } from '@/components/operaciones/kanban-desktop';
import { ToastHost, dismissToast } from '@/components/operaciones/toast';
import type { GrupoCola, PorEstado } from '@/hooks/useColaOperaciones';
import type { ColaBotellon } from '@/lib/db/botellones';

/** Fixture row (age from the real clock, mirrors grupo-card-kanban tests). */
function botellon(i: number, over: Partial<ColaBotellon> = {}): ColaBotellon {
  return {
    id: `b-${i}`,
    codigo: `BOT-00${i}`,
    estado: 'recibido',
    cliente_id: `cliente-${i}`,
    estado_desde: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    clientes: { nombre: 'María González', cedula: '12345678', telefono_1: null, whatsapp: null },
    ...over,
  } as ColaBotellon;
}

function grupo(botellones: ColaBotellon[]): GrupoCola {
  return { cliente_id: botellones[0].cliente_id, estado_desde: botellones[0].estado_desde, botellones };
}

/** Build an empty PorEstado. */
function porEstadoVacio(): PorEstado {
  return { recibido: [], recarga: [], listo: [], delivery: [] };
}

/** Render the 4 columns and return the column element for a given estado label. */
function columnaDe(label: string): HTMLElement {
  const columnas = screen.getAllByTestId('kanban-columna');
  const encontrada = columnas.find((c) => c.getAttribute('aria-label')?.startsWith(label));
  if (!encontrada) throw new Error(`columna ${label} no encontrada`);
  return encontrada;
}

describe('KanbanDesktop — REQ-COS-22/24 column contract', () => {
  afterEach(() => {
    dismissToast(); // module-level toast store: clear it so tests don't leak toasts
  });

  it('renders 4 columns in estado order, each with dot/label/counter/subtitle', () => {
    const porEstado = porEstadoVacio();
    porEstado.recibido = [grupo([botellon(1)])];
    porEstado.listo = [grupo([botellon(2)])];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={vi.fn()} />);

    const columnas = screen.getAllByTestId('kanban-columna');
    expect(columnas).toHaveLength(4);

    // Order is ESTADOS_OPERATIVOS (recibido, recarga, listo, delivery).
    expect(columnas[0]).toHaveAccessibleName(/Recibido/);
    expect(columnas[1]).toHaveAccessibleName(/En recarga/);
    expect(columnas[2]).toHaveAccessibleName(/Listo/);
    expect(columnas[3]).toHaveAccessibleName(/En delivery/);

    // Counter reflects the group count (1 for recibido, 0 for the rest).
    const recibido = columnas[0];
    expect(within(recibido).getByText('Recibido')).toBeInTheDocument();
    expect(within(recibido).getByText('1')).toBeInTheDocument();
    // Subtitle in the header (recibido has a group → no placeholder, single match).
    expect(within(recibido).getByText('Esperando lavado')).toBeInTheDocument();

    const vacia = columnas[1];
    expect(within(vacia).getByText('0')).toBeInTheDocument();
    // recarga is empty → subtitle appears twice (header + "Vacío" placeholder).
    expect(within(vacia).getAllByText('Llenando ahora').length).toBeGreaterThan(0);

    // 2px estado dot present (2px = h-0.5 token).
    const dot = recibido.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot!.className).toContain('h-0.5');
  });

  it('renders a dashed 120px "Vacío" placeholder with the subtitle for empty columns and keeps the grid intact (REQ-24)', () => {
    const porEstado = porEstadoVacio();
    porEstado.recibido = [grupo([botellon(1)])];
    porEstado.listo = [grupo([botellon(2)])];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={vi.fn()} />);

    // 2 populated + 2 empty → still exactly 4 columns (grid intact, REQ-24 S2).
    expect(screen.getAllByTestId('kanban-columna')).toHaveLength(4);

    const recarga = columnaDe('En recarga');
    expect(within(recarga).getByText('Vacío')).toBeInTheDocument();
    // Subtitle in the placeholder (also in the header → 2 matches, assert ≥1).
    expect(within(recarga).getAllByText('Llenando ahora').length).toBeGreaterThan(0);
    // Dashed wrapper, min-height 120px (REQ-24 S1).
    const placeholder = recarga.querySelector('div[class*="border-dashed"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder!.className).toContain('min-h-[120px]');
    expect(placeholder!.className).toContain('border-dashed');

    const delivery = columnaDe('En delivery');
    expect(within(delivery).getByText('Vacío')).toBeInTheDocument();
    expect(within(delivery).getAllByText('En camino al cliente').length).toBeGreaterThan(0);
  });

  it('renders a skeleton per column while loading (REQ-21: skeleton, never a spinner)', () => {
    render(<KanbanDesktop porEstado={porEstadoVacio()} cargando onMover={vi.fn()} />);

    const columnas = screen.getAllByTestId('kanban-columna');
    expect(columnas).toHaveLength(4);
    for (const col of columnas) {
      expect(col.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders compact group cards for each populated column (REQ-22, FIFO porEstado)', () => {
    const porEstado = porEstadoVacio();
    porEstado.recibido = [grupo([botellon(1), botellon(2)]), grupo([botellon(3)])];
    porEstado.delivery = [grupo([botellon(4)])];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={vi.fn()} />);

    // 2 cards in Recibido + 1 in Delivery, all compact group cards rendered.
    expect(screen.getAllByTestId('grupo-card-kanban')).toHaveLength(3);
    expect(within(columnaDe('Recibido')).getAllByTestId('grupo-card-kanban')).toHaveLength(2);
    expect(within(columnaDe('En delivery')).getAllByTestId('grupo-card-kanban')).toHaveLength(1);
  });
});

describe('KanbanDesktop — REQ-COS-25 drag & drop', () => {
  afterEach(() => {
    dismissToast();
  });

  /** Dispatch dragStart on the card with a dataTransfer spy; returns the spy. */
  function arrastrarDesde(card: HTMLElement, getData: (t: string) => string) {
    const dt = {
      effectAllowed: undefined as string | undefined,
      data: '',
      setData(type: string, val: string) {
        this.data = val;
      },
      getData(type: string) {
        return getData(type);
      },
    };
    fireEvent.dragStart(card, { dataTransfer: dt });
    return dt;
  }

  it('moves the whole group on a valid drop: dragStart sets ids, drop reads them and calls onMover', () => {
    const onMover = vi.fn();
    const porEstado = porEstadoVacio();
    porEstado.recibido = [grupo([botellon(1), botellon(2)])];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={onMover} />);

    const card = within(columnaDe('Recibido')).getByTestId('grupo-card-kanban');
    const dt = arrastrarDesde(card, () => 'b-1,b-2');
    // dragstart set the dataTransfer payload (REQ-25).
    expect(dt.data).toBe('b-1,b-2');

    // dragover on the Recarga column prevents default (allows drop).
    const recarga = columnaDe('En recarga');
    fireEvent.dragOver(recarga, { preventDefault: () => undefined });

    // drop reads the ids via getData → onMover(['b-1','b-2'], 'recarga').
    fireEvent.drop(recarga, { dataTransfer: { getData: () => 'b-1,b-2' } });
    expect(onMover).toHaveBeenCalledTimes(1);
    expect(onMover).toHaveBeenCalledWith(['b-1', 'b-2'], 'recarga');
  });

  it('falls back to the parent dragId when getData returns empty (Firefox quirk), and clears it on dragend', () => {
    const onMover = vi.fn();
    const porEstado = porEstadoVacio();
    porEstado.recibido = [grupo([botellon(1)])];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={onMover} />);

    const card = within(columnaDe('Recibido')).getByTestId('grupo-card-kanban');
    // dragStart sets dragId fallback; drop's getData returns '' → uses dragId.
    arrastrarDesde(card, () => '');
    const recarga = columnaDe('En recarga');
    fireEvent.drop(recarga, { dataTransfer: { getData: () => '' } });
    expect(onMover).toHaveBeenCalledWith(['b-1'], 'recarga');

    // dragEnd clears dragId → a later empty-getData drop must NOT move (REQ-25 S4).
    fireEvent.dragEnd(card, { dataTransfer: { getData: () => '' } });
    const recarga2 = columnaDe('En recarga');
    fireEvent.drop(recarga2, { dataTransfer: { getData: () => '' } });
    expect(onMover).toHaveBeenCalledTimes(1); // only the pre-dragEnd drop moved
  });

  it('clears the dragId fallback ON DROP, so a stale fallback cannot fire a later drop (carried)', () => {
    const onMover = vi.fn();
    const porEstado = porEstadoVacio();
    porEstado.recibido = [grupo([botellon(1)])];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={onMover} />);

    const card = within(columnaDe('Recibido')).getByTestId('grupo-card-kanban');
    // dragStart sets the fallback; drop's getData returns '' → uses dragId.
    arrastrarDesde(card, () => '');
    fireEvent.drop(columnaDe('En recarga'), { dataTransfer: { getData: () => '' } });
    expect(onMover).toHaveBeenCalledWith(['b-1'], 'recarga');

    // NO dragEnd fired. The drop itself must clear dragId: a second VALID drop
    // (Recarga again — recibido→recarga is permitted) with empty getData must
    // NOT move — otherwise the stale fallback fires onMover a second time.
    fireEvent.drop(columnaDe('En recarga'), { dataTransfer: { getData: () => '' } });
    expect(onMover).toHaveBeenCalledTimes(1);
  });

  it('accepts a delivery→Recarga drop (now in getEstadosPermitidos) with a single mover call', () => {
    const onMover = vi.fn();
    const porEstado = porEstadoVacio();
    porEstado.delivery = [grupo([botellon(1)])];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={onMover} />);

    const card = within(columnaDe('En delivery')).getByTestId('grupo-card-kanban');
    arrastrarDesde(card, () => 'b-1');

    const recarga = columnaDe('En recarga');
    fireEvent.drop(recarga, { dataTransfer: { getData: () => 'b-1' } });

    // EPIC-16: REVERSIONES.delivery now includes recarga, so delivery→Recarga
    // is a valid manual move (no red toast, one mover call).
    expect(onMover).toHaveBeenCalledTimes(1);
    expect(onMover).toHaveBeenCalledWith(['b-1'], 'recarga');
    expect(screen.queryByText('No se pudo mover. Reintentá.')).not.toBeInTheDocument();
  });

  it('is a no-op on a same-column drop (no mover call, no toast)', () => {
    const onMover = vi.fn();
    const porEstado = porEstadoVacio();
    porEstado.recibido = [grupo([botellon(1)])];
    render(
      <>
        <ToastHost />
        <KanbanDesktop porEstado={porEstado} cargando={false} onMover={onMover} />
      </>
    );

    const card = within(columnaDe('Recibido')).getByTestId('grupo-card-kanban');
    arrastrarDesde(card, () => 'b-1');

    fireEvent.drop(columnaDe('Recibido'), { dataTransfer: { getData: () => 'b-1' } });
    expect(onMover).not.toHaveBeenCalled();
    expect(screen.queryByText('No se pudo mover. Reintentá.')).not.toBeInTheDocument();
  });

  it('does nothing when dropping an unknown/absent drag payload', () => {
    const onMover = vi.fn();
    render(<KanbanDesktop porEstado={porEstadoVacio()} cargando={false} onMover={onMover} />);

    // No card was dragged (no dragId), and getData is empty → nothing to move.
    fireEvent.drop(columnaDe('Recibido'), { dataTransfer: { getData: () => '' } });
    expect(onMover).not.toHaveBeenCalled();
  });
});

describe('KanbanDesktop — REQ-COS-23 WhatsApp wiring (PR-B)', () => {
  afterEach(() => {
    dismissToast();
  });

  it('passes the WhatsApp tap through to onWhatsApp with (grupo, estado) for a phone-holder', () => {
    const onWhatsApp = vi.fn();
    const porEstado = porEstadoVacio();
    porEstado.recibido = [
      grupo([botellon(1, { clientes: { nombre: 'María González', cedula: '12345678', telefono_1: '1144445555', whatsapp: '1144445555' } })]),
    ];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={vi.fn()} onWhatsApp={onWhatsApp} />);

    const card = within(columnaDe('Recibido')).getByTestId('grupo-card-kanban');
    fireEvent.click(within(card).getByRole('button', { name: 'WhatsApp de María González' }));

    expect(onWhatsApp).toHaveBeenCalledTimes(1);
    expect(onWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ cliente_id: 'cliente-1' }), 'recibido');
  });

  it('passes the ficha tap through to onAbrirFicha with (grupo, estado) (REQ-COS-29 wiring)', () => {
    const onAbrirFicha = vi.fn();
    const porEstado = porEstadoVacio();
    porEstado.recibido = [grupo([botellon(1)])];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={vi.fn()} onAbrirFicha={onAbrirFicha} />);

    const card = within(columnaDe('Recibido')).getByTestId('grupo-card-kanban');
    fireEvent.click(within(card).getByRole('button', { name: 'María González' }));

    expect(onAbrirFicha).toHaveBeenCalledTimes(1);
    expect(onAbrirFicha).toHaveBeenCalledWith(expect.objectContaining({ cliente_id: 'cliente-1' }), 'recibido');
  });
});

describe('KanbanDesktop — listo dual actions (manual pickup)', () => {
  afterEach(() => {
    dismissToast();
  });

  it('shows both "→ En delivery" and "✓ Entregar" for a listo card; Entregar moves to entregado', () => {
    const onMover = vi.fn();
    const porEstado = porEstadoVacio();
    porEstado.listo = [grupo([botellon(1), botellon(2)])];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={onMover} />);

    const card = within(columnaDe('Listo')).getByTestId('grupo-card-kanban');
    expect(within(card).getByRole('button', { name: '→ Pasar a En delivery' })).toBeInTheDocument();
    const entregar = within(card).getByRole('button', { name: '✓ Entregar a María' });
    expect(entregar).toBeInTheDocument();

    fireEvent.click(entregar);
    expect(onMover).toHaveBeenCalledWith(['b-1', 'b-2'], 'entregado');
  });

  it('renders exactly one action for non-listo cards', () => {
    const porEstado = porEstadoVacio();
    porEstado.recibido = [grupo([botellon(1)])];
    render(<KanbanDesktop porEstado={porEstado} cargando={false} onMover={vi.fn()} />);

    const card = within(columnaDe('Recibido')).getByTestId('grupo-card-kanban');
    expect(within(card).getByRole('button', { name: '→ Pasar a En recarga' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /✓ Entregar/ })).not.toBeInTheDocument();
  });
});
