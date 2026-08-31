import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { HistorialCliente } from '@/components/clientes/historial-cliente';

// ── Supabase browser client mock (chain pattern) ──
const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: createClientMock }));

type Cadena = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
};

function makeCadena(todas: unknown[]) {
  const cadena: Cadena = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    range: vi.fn(),
    then: vi.fn(),
  };
  cadena.select.mockReturnValue(cadena);
  cadena.eq.mockReturnValue(cadena);
  cadena.gte.mockReturnValue(cadena);
  cadena.lte.mockReturnValue(cadena);
  cadena.order.mockReturnValue(cadena);
  cadena.in.mockReturnValue(cadena);
  // Simulate server-side pagination: the mock slices the full dataset like the
  // real COUNT + RANGE query would, so the component sees 20-of-25 and renders
  // the "Cargar más" button.
  cadena.range.mockImplementation((from: number, to: number) =>
    Promise.resolve({ data: todas.slice(from, to + 1), count: todas.length, error: null })
  );
  // The botellones chips fetch resolves through .then().
  cadena.then.mockImplementation((cb: (v: unknown) => unknown) =>
    Promise.resolve(cb({ data: todas, count: todas.length, error: null }))
  );
  return cadena;
}

/** Chainable realtime channel mock (`.on` returns the same channel). */
function makeChannel() {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(),
  };
  return channel;
}

function montar(opts: { botellones?: unknown[]; movs?: unknown[] } = {}) {
  const { botellones = [], movs = [] } = opts;
  const cadenas: Record<string, Cadena> = {};
  const supabase = {
    from: vi.fn((tabla: string) => {
      if (!cadenas[tabla]) {
        const datos = tabla === 'botellones' ? botellones : movs;
        cadenas[tabla] = makeCadena(datos);
      }
      return cadenas[tabla];
    }),
    channel: vi.fn(() => makeChannel()),
    removeChannel: vi.fn(),
  };
  createClientMock.mockReturnValue(supabase);
  render(<HistorialCliente clienteId="c-1" />);
  return { supabase, cadenas };
}

const BOTELLONES = [{ id: 'b-1', codigo: 'B-001', estado: 'recibido' }];

const MOV = (id: string, de: string, a: string, created_at: string) => ({
  id,
  estado_previo: de,
  estado_nuevo: a,
  created_at,
  botellones: { codigo: 'B-001' },
});

beforeEach(() => {
  createClientMock.mockClear();
});

describe('HistorialCliente — movimientos + botellon filter + pagination', () => {
  it('renders the Estados history by default with movements, dots, badges and chips', async () => {
    montar({ botellones: BOTELLONES, movs: [MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')] });
    await waitFor(() => expect(screen.getByText('Entregado → Recibido')).toBeInTheDocument());
    expect(screen.getByRole('cell', { name: 'Recibir' })).toBeInTheDocument();
    // Movimiento dot takes its color from the new estado, plus the badge in the
    // Cambio cell, and the per-botellon chips.
    expect(document.querySelector('span.bg-slate-500')).toBeInTheDocument();
    expect(screen.getByText(/4:31 PM/)).toBeInTheDocument();
    expect(screen.getAllByText('B-001').length).toBeGreaterThan(0);
    expect(screen.getByText('Todos los botellones')).toBeInTheDocument();
    // No tabs any more — the "Recargas" tab is gone.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('filters by a specific botellon chip', async () => {
    const { cadenas } = montar({ botellones: BOTELLONES, movs: [MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')] });
    await waitFor(() => expect(screen.getAllByText('B-001').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /B-001/ }));
    await waitFor(() =>
      expect(cadenas.movimientos.eq).toHaveBeenCalledWith('botellon_id', 'b-1')
    );
  });

  it('shows "Cargar más" when there are more rows than one page and appends', async () => {
    const muchos = Array.from({ length: 25 }, (_, i) =>
      MOV(`m${i}`, 'entregado', 'recibido', `2026-08-28T20:${String(i).padStart(2, '0')}:00.000Z`)
    );
    montar({ botellones: BOTELLONES, movs: muchos });
    const boton = await screen.findByRole('button', { name: /Cargar más/ });
    expect(boton.textContent).toContain('20 de 25');

    fireEvent.click(boton);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Cargar más \(25 de 25\)/ })).not.toBeInTheDocument();
    });
  });

  it('date filters reload with gte/lte on the movimientos query and toggle the Limpiar button', async () => {
    const { cadenas } = montar({ botellones: BOTELLONES, movs: [MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')] });
    await waitFor(() => expect(screen.getAllByText('B-001').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-08-31' } });

    await waitFor(() => {
      expect(cadenas.movimientos.gte).toHaveBeenCalledWith('created_at', '2026-08-01');
      // Inclusive `hasta`: timestamptz filter caps at end-of-day for the day.
      expect(cadenas.movimientos.lte).toHaveBeenCalledWith('created_at', '2026-08-31T23:59:59');
    });

    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument();
    });
  });

  it('estado filter applies eq(estado_nuevo) on movimientos and Limpiar resets it', async () => {
    const { cadenas } = montar({ botellones: BOTELLONES, movs: [MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')] });
    await waitFor(() => expect(screen.getByText('Entregado → Recibido')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'recibido' } });
    await waitFor(() => {
      expect(cadenas.movimientos.eq).toHaveBeenCalledWith('estado_nuevo', 'recibido');
    });

    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument();
    });
  });

  it('shows an empty state when there are no records', async () => {
    montar({ botellones: BOTELLONES });
    await waitFor(() => expect(screen.getByText('No hay registros.')).toBeInTheDocument());
  });

  it('coalesces back-to-back realtime events into a single trailing reload', async () => {
    const { supabase, cadenas } = montar({
      botellones: BOTELLONES,
      movs: [MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')],
    });
    await waitFor(() => expect(screen.getAllByText('B-001').length).toBeGreaterThan(0));

    // Grab the movimientos INSERT callback registered on the realtime channel.
    const channel = supabase.channel.mock.results[0].value as {
      on: ReturnType<typeof vi.fn>;
    };
    const call = channel.on.mock.calls.find(
      ([, config]) => (config as { table?: string }).table === 'movimientos'
    );
    const movimientosHandler = call?.[2] as (payload: unknown) => void;
    expect(movimientosHandler).toBeDefined();

    // Hold the first reload open so we can observe the in-flight window.
    let resolver: () => void = () => {};
    cadenas.movimientos.range.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = () => resolve({ data: [MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')], count: 1, error: null });
        })
    );
    cadenas.movimientos.range.mockClear();

    const payload = { new: { botellon_id: 'b-1' } };
    await act(async () => {
      movimientosHandler(payload);
      movimientosHandler(payload);
    });

    // Second event coalesced: while the first reload is in flight only ONE fetch ran.
    expect(cadenas.movimientos.range).toHaveBeenCalledTimes(1);

    // Release the first fetch: the pending flag triggers exactly one trailing reload.
    await act(async () => {
      resolver();
    });
    await waitFor(() => expect(cadenas.movimientos.range).toHaveBeenCalledTimes(2));
  });
});
