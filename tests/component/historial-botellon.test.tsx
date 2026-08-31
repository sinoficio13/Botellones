import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { HistorialBotellon } from '@/components/botellones/historial-botellon';

// ── Supabase browser client mock (chain pattern) ──
const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: createClientMock }));

type Cadena = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
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
    range: vi.fn(),
    then: vi.fn(),
  };
  cadena.select.mockReturnValue(cadena);
  cadena.eq.mockReturnValue(cadena);
  cadena.gte.mockReturnValue(cadena);
  cadena.lte.mockReturnValue(cadena);
  cadena.order.mockReturnValue(cadena);
  // Simulate server-side pagination: the mock slices the full dataset like the
  // real COUNT + RANGE query would, so the component sees 20-of-25 and renders
  // the "Cargar más" button.
  cadena.range.mockImplementation((from: number, to: number) =>
    Promise.resolve({ data: todas.slice(from, to + 1), count: todas.length, error: null })
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

function montar(movs: unknown[], botellonId = 'b-1') {
  const cadenas: Record<string, Cadena> = {};
  const supabase = {
    from: vi.fn((tabla: string) => {
      if (!cadenas[tabla]) cadenas[tabla] = makeCadena(movs);
      return cadenas[tabla];
    }),
    channel: vi.fn(() => makeChannel()),
    removeChannel: vi.fn(),
  };
  createClientMock.mockReturnValue(supabase);
  render(<HistorialBotellon botellonId={botellonId} />);
  return { supabase, cadenas };
}

const MOV = (id: string, de: string, a: string, created_at: string) => ({
  id,
  estado_previo: de,
  estado_nuevo: a,
  created_at,
});

beforeEach(() => {
  createClientMock.mockClear();
});

describe('HistorialBotellon — movimientos + pagination', () => {
  it('renders the Estados history by default with movements and the operation label', async () => {
    montar([MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')]);
    await waitFor(() => expect(screen.getByText('Entregado → Recibido')).toBeInTheDocument());
    expect(screen.getByRole('cell', { name: 'Recibir' })).toBeInTheDocument();
    // 12-hour clock, correct local date
    expect(screen.getByText(/4:31 PM/)).toBeInTheDocument();
    // No tabs any more — the "Recargas" tab is gone.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('shows "Cargar más" when there are more rows than one page and appends', async () => {
    const muchos = Array.from({ length: 25 }, (_, i) =>
      MOV(`m${i}`, 'entregado', 'recibido', `2026-08-28T20:${String(i).padStart(2, '0')}:00.000Z`)
    );
    montar(muchos);
    const boton = await screen.findByRole('button', { name: /Cargar más/ });
    expect(boton.textContent).toContain('20 de 25');

    fireEvent.click(boton);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Cargar más \(25 de 25\)/ })).not.toBeInTheDocument();
    });
  });

  it('shows an empty state when there are no records', async () => {
    montar([]);
    await waitFor(() => expect(screen.getByText('No hay registros.')).toBeInTheDocument());
  });

  it('date filters reload with gte/lte on the query and toggle the Limpiar button', async () => {
    const { cadenas } = montar([MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')]);
    await waitFor(() => expect(screen.getByText('Entregado → Recibido')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-08-31' } });

    await waitFor(() => {
      expect(cadenas.movimientos.gte).toHaveBeenCalledWith('created_at', '2026-08-01');
      // Inclusive `hasta`: timestamptz filter caps at end-of-day so the whole
      // selected day is included (not just midnight).
      expect(cadenas.movimientos.lte).toHaveBeenCalledWith('created_at', '2026-08-31T23:59:59');
    });

    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument();
    });
  });

  it('estado filter applies eq(estado_nuevo) on movimientos and Limpiar resets it', async () => {
    const { cadenas } = montar([MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')]);
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
});