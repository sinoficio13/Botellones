import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { BuscadorClienteCarga } from '@/components/operaciones/buscador-cliente-carga';
import type { BotellonesClienteResult } from '@/lib/db/botellones';

const getClientesForSearchMock = vi.hoisted(() => vi.fn());
const getBotellonesClienteMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db/recargas', () => ({
  getClientesForSearch: getClientesForSearchMock,
}));
vi.mock('@/lib/db/botellones', () => ({
  getBotellonesCliente: getBotellonesClienteMock,
}));

const SEARCH_LABEL = 'o buscá por cliente:';
const CLIENTE = { id: 'c1', nombre: 'Juan Pérez', codigo: 'CLI-001', telefono_1: '1144445555' };

function respuestaBotellones(
  botellones: { id: string; codigo: string; estado: string; estado_desde?: string }[]
): BotellonesClienteResult {
  return {
    cliente: {
      id: 'c1',
      nombre: 'Juan Pérez',
      cedula: '12345678',
      telefono_1: '1144445555',
      whatsapp: '1144445555',
    },
    direccion: null,
    botellones: botellones.map((b) => ({
      id: b.id,
      codigo: b.codigo,
      estado: b.estado,
      estado_desde: b.estado_desde ?? '2026-08-20T09:00:00.000Z',
    })),
  };
}

/** Type a search term and advance the 250ms debounce inside act. */
async function buscar(texto: string, ms = 250) {
  fireEvent.change(screen.getByLabelText(SEARCH_LABEL), { target: { value: texto } });
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Expand a client row and flush the pending getBotellonesCliente microtask. */
async function expandirCliente() {
  fireEvent.click(screen.getByRole('button', { name: /Juan Pérez/ }));
  await act(async () => {});
}

function montar(onAgregar = vi.fn(), enSesion: Set<string> = new Set<string>()) {
  return render(<BuscadorClienteCarga onAgregar={onAgregar} enSesion={enSesion} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  getClientesForSearchMock.mockReset();
  getBotellonesClienteMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BuscadorClienteCarga — search', () => {
  it('renders the labeled section and never searches below the min-2 gate', () => {
    getClientesForSearchMock.mockResolvedValue([]);
    montar();

    expect(screen.getByLabelText(SEARCH_LABEL)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(SEARCH_LABEL), { target: { value: 'm' } });
    act(() => vi.advanceTimersByTime(300));

    expect(getClientesForSearchMock).not.toHaveBeenCalled();
  });

  it('fires the search only after 250ms of debounce with 2+ chars and renders the clients', async () => {
    getClientesForSearchMock.mockResolvedValue([CLIENTE]);
    montar();

    fireEvent.change(screen.getByLabelText(SEARCH_LABEL), { target: { value: 'ju' } });
    act(() => vi.advanceTimersByTime(249));
    expect(getClientesForSearchMock).not.toHaveBeenCalled();

    await buscar('ju', 1);
    expect(getClientesForSearchMock).toHaveBeenCalledTimes(1);
    expect(getClientesForSearchMock).toHaveBeenCalledWith('ju');

    // Client row: nombre + codigo + telefono_1.
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('CLI-001')).toBeInTheDocument();
    expect(screen.getByText('1144445555')).toBeInTheDocument();
  });

  it('debounces rapid typing into a single call with the final term', async () => {
    getClientesForSearchMock.mockResolvedValue([CLIENTE]);
    montar();

    await buscar('mar');
    expect(getClientesForSearchMock).toHaveBeenCalledTimes(1);
    expect(getClientesForSearchMock).toHaveBeenCalledWith('mar');
  });

  it('shows a muted "Sin resultados" when a completed search has zero matches', async () => {
    getClientesForSearchMock.mockResolvedValue([]);
    montar();

    await buscar('xyz');
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument();
  });
});

describe('BuscadorClienteCarga — expanding a client', () => {
  it('fetches the client bottles and shows the actionable ones with [+] buttons', async () => {
    getClientesForSearchMock.mockResolvedValue([CLIENTE]);
    getBotellonesClienteMock.mockResolvedValue(
      respuestaBotellones([
        { id: 'b1', codigo: 'BOT-00001', estado: 'entregado' },
        { id: 'b2', codigo: 'BOT-00002', estado: 'recarga' },
      ])
    );
    montar();

    await buscar('jua');
    await expandirCliente();

    expect(getBotellonesClienteMock).toHaveBeenCalledWith('c1');
    expect(screen.getByText('BOT-00001')).toBeInTheDocument();
    expect(screen.getByText('Entregado')).toBeInTheDocument();
    expect(screen.getByText('BOT-00002')).toBeInTheDocument();
    expect(screen.getByText('En recarga')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Agregar' })).toHaveLength(2);
  });

  it('treats listo bottles as actionable (listo → En delivery/Entregar chooser)', async () => {
    getClientesForSearchMock.mockResolvedValue([CLIENTE]);
    getBotellonesClienteMock.mockResolvedValue(
      respuestaBotellones([
        { id: 'b1', codigo: 'BOT-00001', estado: 'listo' },
        { id: 'b2', codigo: 'BOT-00002', estado: 'entregado' },
      ])
    );
    montar();

    await buscar('jua');
    await expandirCliente();

    expect(screen.getByText('BOT-00001')).toBeInTheDocument();
    expect(screen.getByText('Listo')).toBeInTheDocument();
    expect(screen.getByText('BOT-00002')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Agregar' })).toHaveLength(2);
  });

  it('shows a muted hint when the client has no bottles to add', async () => {
    getClientesForSearchMock.mockResolvedValue([CLIENTE]);
    getBotellonesClienteMock.mockResolvedValue(respuestaBotellones([]));
    montar();

    await buscar('jua');
    await expandirCliente();

    expect(screen.getByText('Sin botellones accionables.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Agregar' })).not.toBeInTheDocument();
  });

  it('shows delivery bottles as actionable (En delivery → Entregar)', async () => {
    getClientesForSearchMock.mockResolvedValue([CLIENTE]);
    getBotellonesClienteMock.mockResolvedValue(
      respuestaBotellones([{ id: 'b9', codigo: 'BOT-00009', estado: 'delivery' }])
    );
    montar();

    await buscar('jua');
    await expandirCliente();

    expect(screen.getByText('BOT-00009')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Agregar' })).toBeInTheDocument();
  });
});

describe('BuscadorClienteCarga — adding bottles', () => {
  it('clicking [+] calls onAgregar with the right shape', async () => {
    getClientesForSearchMock.mockResolvedValue([CLIENTE]);
    getBotellonesClienteMock.mockResolvedValue(
      respuestaBotellones([{ id: 'b1', codigo: 'BOT-00001', estado: 'recibido' }])
    );
    const onAgregar = vi.fn();
    montar(onAgregar);

    await buscar('jua');
    await expandirCliente();
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar' }));

    expect(onAgregar).toHaveBeenCalledTimes(1);
    expect(onAgregar).toHaveBeenCalledWith({
      id: 'b1',
      codigo: 'BOT-00001',
      cliente_id: 'c1',
      estado: 'recibido',
    });
  });

  it('shows a muted "Agregado" mark (no button) for a bottle already in the session', async () => {
    getClientesForSearchMock.mockResolvedValue([CLIENTE]);
    getBotellonesClienteMock.mockResolvedValue(
      respuestaBotellones([{ id: 'b1', codigo: 'BOT-00001', estado: 'entregado' }])
    );
    montar(vi.fn(), new Set(['b1']));

    await buscar('jua');
    await expandirCliente();

    expect(screen.getByText('Agregado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Agregar' })).not.toBeInTheDocument();
  });

  it('shows a transient hint when onAgregar returns false (entry blocked while confirming)', async () => {
    getClientesForSearchMock.mockResolvedValue([CLIENTE]);
    getBotellonesClienteMock.mockResolvedValue(
      respuestaBotellones([{ id: 'b1', codigo: 'BOT-00001', estado: 'recibido' }])
    );
    const onAgregar = vi.fn().mockResolvedValue(false);
    montar(onAgregar);

    await buscar('jua');
    await expandirCliente();
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar' }));
    await act(async () => {});

    expect(onAgregar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Confirmando… esperá un momento')).toBeInTheDocument();
  });
});