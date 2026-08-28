import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { HistorialBotellon } from '@/components/botellones/historial-botellon';

// ── Supabase browser client mock (chain pattern) ──
const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: createClientMock }));

type Cadena = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
};

function makeCadena(todas: unknown[]) {
  const cadena: Cadena = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    then: vi.fn(),
  };
  cadena.select.mockReturnValue(cadena);
  cadena.eq.mockReturnValue(cadena);
  cadena.order.mockReturnValue(cadena);
  // Simulate server-side pagination: the mock slices the full dataset like the
  // real COUNT + RANGE query would, so the component sees 20-of-25 and renders
  // the "Cargar más" button.
  cadena.range.mockImplementation((from: number, to: number) =>
    Promise.resolve({ data: todas.slice(from, to + 1), count: todas.length, error: null })
  );
  return cadena;
}

function montar(movs: unknown[], recs: unknown[], botellonId = 'b-1') {
  const supabase = {
    from: vi.fn((tabla: string) => {
      if (tabla === 'movimientos') {
        return makeCadena(movs);
      }
      return makeCadena(recs);
    }),
  };
  createClientMock.mockReturnValue(supabase);
  render(<HistorialBotellon botellonId={botellonId} />);
  return supabase;
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

describe('HistorialBotellon — tabs + pagination', () => {
  it('renders the Estados tab by default with movements and the operation label', async () => {
    montar([MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')], []);
    await waitFor(() => expect(screen.getByText('Entregado → Recibido')).toBeInTheDocument());
    expect(screen.getByText('Recibir')).toBeInTheDocument();
    // 12-hour clock, correct local date
    expect(screen.getByText(/4:31 PM/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Estados(1)' })).toBeInTheDocument();
  });

  it('shows "Cargar más" when there are more rows than one page and appends', async () => {
    const muchos = Array.from({ length: 25 }, (_, i) =>
      MOV(`m${i}`, 'entregado', 'recibido', `2026-08-28T20:${String(i).padStart(2, '0')}:00.000Z`)
    );
    montar(muchos, []);
    const boton = await screen.findByRole('button', { name: /Cargar más/ });
    expect(boton.textContent).toContain('20 de 25');

    fireEvent.click(boton);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Cargar más \(25 de 25\)/ })).not.toBeInTheDocument();
    });
  });

  it('switches to the Recargas tab and shows REC numbers', async () => {
    montar(
      [MOV('m1', 'entregado', 'recibido', '2026-08-28T20:31:00.000Z')],
      [{ id: 'r1', fecha: '2026-08-28', hora: '16:35:00', numero_registro: 'REC-000009' }]
    );
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Recargas' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: 'Recargas' }));

    await waitFor(() => expect(screen.getByText('REC-000009')).toBeInTheDocument());
    expect(screen.getByText(/Recarga ·/)).toBeInTheDocument();
    expect(screen.getByText(/4:35 PM/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Recargas(1)' })).toBeInTheDocument();
  });

  it('shows an empty state when there are no records', async () => {
    montar([], []);
    await waitFor(() => expect(screen.getByText('No hay registros.')).toBeInTheDocument());
  });
});