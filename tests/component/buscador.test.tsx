import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Buscador } from '@/components/operaciones/buscador';
import type { ResultadoBusqueda } from '@/lib/db/botellones';
import type { ColaBotellon } from '@/lib/db/botellones';

const { buscarColaOperacionesMock } = vi.hoisted(() => ({
  buscarColaOperacionesMock: vi.fn(),
}));
vi.mock('@/lib/db/botellones', () => ({ buscarColaOperaciones: buscarColaOperacionesMock }));

/**
 * Buscador — REQ-COS-20. All timing assertions use vitest fake timers:
 * 250ms debounce (use-debounce reused), min-2 gate (a single character never
 * searches), results grouped by Nombre / Cédula / Código, and clear behavior
 * when the input drops below the minimum.
 */

function botellon(i: number, over: Partial<ColaBotellon> = {}): ColaBotellon {
  return {
    id: `b-${i}`,
    codigo: `BOT-00${i}`,
    estado: 'recibido',
    cliente_id: 'cliente-a',
    estado_desde: '2026-08-20T09:00:00.000Z',
    clientes: { nombre: 'María González', cedula: '12345678', telefono_1: null, whatsapp: null },
    ...over,
  };
}

function sinResultados(): ResultadoBusqueda {
  return { porNombre: [], porCedula: [], porCodigo: [] };
}

function escribir(texto: string) {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: texto } });
}

async function buscar(texto: string, ms = 250) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('Buscador — REQ-COS-20', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    buscarColaOperacionesMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never searches with a single character (min-2 gate, S2)', () => {
    render(<Buscador />);
    escribir('m');
    act(() => vi.advanceTimersByTime(300));

    expect(buscarColaOperacionesMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('fires the search only after 250ms of debounce with 2+ chars (S1)', async () => {
    buscarColaOperacionesMock.mockResolvedValue(sinResultados());
    render(<Buscador />);
    escribir('ma');

    act(() => vi.advanceTimersByTime(249));
    expect(buscarColaOperacionesMock).not.toHaveBeenCalled();

    await buscar('ma', 1);
    expect(buscarColaOperacionesMock).toHaveBeenCalledTimes(1);
    expect(buscarColaOperacionesMock).toHaveBeenCalledWith('ma');
  });

  it('debounces rapid typing into a single call with the final term', async () => {
    buscarColaOperacionesMock.mockResolvedValue(sinResultados());
    render(<Buscador />);
    escribir('m');
    escribir('ma');
    escribir('mar');

    await buscar('mar');
    expect(buscarColaOperacionesMock).toHaveBeenCalledTimes(1);
    expect(buscarColaOperacionesMock).toHaveBeenCalledWith('mar');
  });

  it('renders results grouped by Nombre / Cédula / Código with items in their bucket', async () => {
    buscarColaOperacionesMock.mockResolvedValue({
      porNombre: [
        botellon(1, {
          clientes: { nombre: 'María', cedula: '12345678', telefono_1: null, whatsapp: null },
        }),
      ],
      porCedula: [
        botellon(2, {
          clientes: { nombre: 'José', cedula: '12345678', telefono_1: null, whatsapp: null },
        }),
      ],
      porCodigo: [botellon(3, { codigo: 'BOT-003' })],
    });
    render(<Buscador />);
    escribir('mar');
    await buscar('mar');

    expect(screen.getByRole('heading', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cédula' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Código' })).toBeInTheDocument();

    const porNombre = screen.getByRole('region', { name: 'Resultados por nombre' });
    expect(within(porNombre).getByText('María')).toBeInTheDocument();
    expect(within(porNombre).getByText('BOT-001')).toBeInTheDocument();

    const porCedula = screen.getByRole('region', { name: 'Resultados por cédula' });
    expect(within(porCedula).getByText('José')).toBeInTheDocument();
    expect(within(porCedula).getByText('12345678')).toBeInTheDocument();

    const porCodigo = screen.getByRole('region', { name: 'Resultados por código' });
    expect(within(porCodigo).getByText('BOT-003')).toBeInTheDocument();
  });

  it('clears the results when the input drops below 2 chars and fires no extra search', async () => {
    buscarColaOperacionesMock.mockResolvedValue({
      porNombre: [
        botellon(1, {
          clientes: { nombre: 'María', cedula: '12345678', telefono_1: null, whatsapp: null },
        }),
      ],
      porCedula: [],
      porCodigo: [],
    });
    render(<Buscador />);
    escribir('mar');
    await buscar('mar');
    expect(screen.getByRole('region', { name: 'Resultados por nombre' })).toBeInTheDocument();

    escribir('');
    act(() => vi.advanceTimersByTime(300));

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(buscarColaOperacionesMock).toHaveBeenCalledTimes(1); // still just the 'mar' search
  });

  it('shows an empty-state message when a completed search has zero matches', async () => {
    buscarColaOperacionesMock.mockResolvedValue(sinResultados());
    render(<Buscador />);
    escribir('xyz');
    await buscar('xyz');

    expect(screen.getByText('Sin resultados para «xyz»')).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('shows an error message when the server helper rejects', async () => {
    buscarColaOperacionesMock.mockRejectedValue(new Error('boom'));
    render(<Buscador />);
    escribir('mar');
    await buscar('mar');

    expect(screen.getByRole('alert')).toHaveTextContent('Error al buscar. Reintentá.');
  });
});