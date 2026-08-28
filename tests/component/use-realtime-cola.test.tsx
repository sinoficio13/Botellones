import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { useRealtimeCola, normalizarEvento } from '@/hooks/useRealtimeCola';
import { useColaOperaciones, mergeEvento } from '@/hooks/useColaOperaciones';
import type { ColaBotellon } from '@/lib/db/botellones';

// ── Supabase browser client mock (estado-en-vivo fake-channel pattern) ──
const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: createClientMock }));
const { getColaOperacionesMock } = vi.hoisted(() => ({ getColaOperacionesMock: vi.fn() }));
vi.mock('@/lib/db/botellones', () => ({ getColaOperaciones: getColaOperacionesMock }));

type FakeChannel = {
  name: string;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  payloadHandler: ((payload: unknown) => void) | null;
  statusHandler: ((status: string) => void) | null;
};

function makeFakeSupabase() {
  const channels: FakeChannel[] = [];
  const supabase = {
    channel: vi.fn((name: string) => {
      const ch: FakeChannel = {
        name,
        on: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        payloadHandler: null,
        statusHandler: null,
      };
      ch.on.mockImplementation((_e: string, _c: unknown, cb: (p: unknown) => void) => {
        ch.payloadHandler = cb;
        return ch;
      });
      ch.subscribe.mockImplementation((cb?: (s: string) => void) => {
        ch.statusHandler = cb ?? null;
        return ch;
      });
      channels.push(ch);
      return ch;
    }),
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return { supabase, channels };
}

const fake = makeFakeSupabase();

function emit(channel: FakeChannel, payload: unknown) {
  act(() => channel.payloadHandler?.(payload));
}
function setStatus(channel: FakeChannel, status: string) {
  act(() => channel.statusHandler?.(status));
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fake.supabase.channel.mockClear();
  fake.supabase.removeChannel.mockClear();
  fake.channels.length = 0;
  createClientMock.mockReturnValue(fake.supabase);
  getColaOperacionesMock.mockReset();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.clearAllMocks();
  vi.useRealTimers();
});

/** Fixture ColaBotellon row (client-owned). */
function botellon(o: Partial<ColaBotellon> & { id: string }): ColaBotellon {
  return {
    codigo: 'BOT-001',
    estado: 'recibido',
    cliente_id: 'cliente-a',
    estado_desde: '2026-08-20T09:00:00.000Z',
    clientes: { nombre: 'María', cedula: '12345678', telefono_1: null, whatsapp: null },
    ...o,
  } as ColaBotellon;
}

/** Raw postgres_changes payload shape. */
function payload(eventType: 'INSERT' | 'UPDATE' | 'DELETE', row: { id: string; estado?: string; cliente_id?: string | null; estado_desde?: string }) {
  return {
    eventType,
    schema: 'public',
    table: 'botellones',
    new: eventType === 'DELETE' ? null : row,
    old: eventType === 'DELETE' ? { id: row.id } : { id: row.id },
  };
}

describe('useRealtimeCola — channel lifecycle (REQ-COS-27)', () => {
  it('subscribes to postgres_changes event * on botellones via channel cola-realtime', () => {
    function Harness({ onEvento }: { onEvento: (e: unknown) => void }) {
      useRealtimeCola(onEvento as (e: unknown) => void);
      return <div />;
    }
    render(<Harness onEvento={() => {}} />);

    const channel = fake.channels[0];
    expect(fake.supabase.channel).toHaveBeenCalledWith('cola-realtime');
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'botellones' },
      expect.any(Function)
    );
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('calls removeChannel on unmount', () => {
    function Harness() {
      useRealtimeCola(() => {});
      return <div />;
    }
    const { unmount } = render(<Harness />);
    const channel = fake.channels[0];
    unmount();
    expect(fake.supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('degrades silently on CHANNEL_ERROR and TIMED_OUT (warn only, no error UI)', () => {
    function Harness() {
      useRealtimeCola(() => {});
      return <div />;
    }
    render(<Harness />);
    const channel = fake.channels[0];
    setStatus(channel, 'CHANNEL_ERROR');
    setStatus(channel, 'TIMED_OUT');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('normalizarEvento maps a payload to an id + estadoNuevo + clienteIdNuevo + estadoDesdeNuevo', () => {
    expect(normalizarEvento(payload('UPDATE', { id: 'b1', estado: 'recarga', cliente_id: 'c1', estado_desde: '2026-08-28T12:00:00.000Z' }) as never)).toEqual({
      eventType: 'UPDATE',
      id: 'b1',
      estadoNuevo: 'recarga',
      clienteIdNuevo: 'c1',
      estadoDesdeNuevo: '2026-08-28T12:00:00.000Z',
    });
    expect(normalizarEvento(payload('DELETE', { id: 'b1' }) as never)).toEqual({
      eventType: 'DELETE',
      id: 'b1',
      estadoNuevo: undefined,
      clienteIdNuevo: null,
      estadoDesdeNuevo: undefined,
    });
    expect(normalizarEvento({ eventType: 'UNKNOWN', new: {} } as never)).toBeNull();
    expect(normalizarEvento(payload('UPDATE', {} as never) as never)).toBeNull();
  });

  it('mergeEvento patches estado_desde from the event (FIFO order + age match the DB)', () => {
    const filas: ColaBotellon[] = [botellon({ id: 'b1' })];
    const siguiente = mergeEvento(filas, {
      eventType: 'UPDATE',
      id: 'b1',
      estadoNuevo: 'recarga',
      clienteIdNuevo: 'cliente-a',
      estadoDesdeNuevo: '2026-08-28T12:00:00.000Z',
    });
    expect(siguiente[0].estado).toBe('recarga');
    expect(siguiente[0].estado_desde).toBe('2026-08-28T12:00:00.000Z');
    expect(siguiente[0].clientes).toBe(filas[0].clientes); // join preserved
  });

  it('mergeEvento keeps the previous estado_desde when the event has none', () => {
    const filas: ColaBotellon[] = [botellon({ id: 'b1' })];
    const siguiente = mergeEvento(filas, {
      eventType: 'UPDATE',
      id: 'b1',
      estadoNuevo: 'recarga',
      clienteIdNuevo: 'cliente-a',
      estadoDesdeNuevo: undefined,
    });
    expect(siguiente[0].estado_desde).toBe('2026-08-20T09:00:00.000Z');
  });
});

describe('useColaOperaciones — realtime gate/queue (REQ-COS-27)', () => {
  async function cargar(filas: ColaBotellon[]) {
    getColaOperacionesMock.mockResolvedValue(filas);
    const r = renderHook(() => useColaOperaciones({ tab: 'recibido' }));
    await act(async () => {});
    return r;
  }

  it('queues a change while scrolling: pendientes increments and the visible list freezes (S1)', async () => {
    const r = await cargar([botellon({ id: 'b1' }), botellon({ id: 'b2', cliente_id: 'cliente-b' })]);
    expect(r.result.current.pendientes).toBe(0);

    act(() => r.result.current.setScrolleando(true));
    emit(fake.channels[0], payload('UPDATE', { id: 'b1', estado: 'recarga', cliente_id: 'cliente-a' }));

    expect(r.result.current.pendientes).toBe(1);
    // Visible list frozen: b1 still in recibido in the gated snapshot.
    expect(r.result.current.porEstadoVisibles.recibido.map((g) => g.cliente_id)).toEqual(['cliente-a', 'cliente-b']);
    // Live counters still bumped: b1 left recibido in the LIVE list.
    expect(r.result.current.porEstado.recibido.map((g) => g.cliente_id)).toEqual(['cliente-b']);
    expect(r.result.current.porEstado.recarga.map((g) => g.cliente_id)).toEqual(['cliente-a']);
  });

  it('applies MULTIPLE realtime events in ONE batch — every botellon moves, not just the last (regression: second screen showed 1 of 4)', async () => {
    const r = await cargar([
      botellon({ id: 'b1' }),
      botellon({ id: 'b2', cliente_id: 'cliente-b', estado: 'recibido' }),
      botellon({ id: 'b3', cliente_id: 'cliente-c', estado: 'recibido' }),
      botellon({ id: 'b4', cliente_id: 'cliente-d', estado: 'recibido' }),
    ]);

    // 4 events dispatched synchronously in the same websocket batch (act block).
    act(() => {
      for (const id of ['b1', 'b2', 'b3', 'b4']) {
        const clienteId = id === 'b1' ? 'cliente-a' : `cliente-${id.slice(1)}`;
        fake.channels[0]?.payloadHandler?.(
          payload('UPDATE', { id, estado: 'recarga', cliente_id: clienteId })
        );
      }
    });

    expect(r.result.current.porEstado.recibido).toEqual([]);
    expect(r.result.current.porEstado.recarga.map((g) => g.cliente_id).sort()).toEqual([
      'cliente-2',
      'cliente-3',
      'cliente-4',
      'cliente-a',
    ]);
  });

  it('applies a change at rest DIRECTLY even when it reorders the active tab; non-visible change also direct (scroll-only gate S2)', async () => {
    const r = await cargar([
      botellon({ id: 'b1' }),
      botellon({ id: 'b2', cliente_id: 'cliente-b', estado: 'recarga' }),
    ]);
    // Active tab = recibido. At rest (NO scroll): b1 leaving recibido applies
    // DIRECTLY — product decision: every connected operator sees changes at once.
    emit(fake.channels[0], payload('UPDATE', { id: 'b1', estado: 'listo', cliente_id: 'cliente-a' }));
    expect(r.result.current.pendientes).toBe(0);
    expect(r.result.current.porEstado.recibido.map((g) => g.cliente_id)).toEqual([]);

    // A non-visible change also applies directly at rest.
    emit(fake.channels[0], payload('UPDATE', { id: 'b2', estado: 'listo', cliente_id: 'cliente-b' }));
    expect(r.result.current.pendientes).toBe(0);
    expect(r.result.current.porEstado.listo.map((g) => g.cliente_id).sort()).toEqual(['cliente-a', 'cliente-b']);
    expect(r.result.current.porEstado.recarga).toEqual([]);
  });

  it('chip tap applies the queue and clears pendientes (S3)', async () => {
    const r = await cargar([botellon({ id: 'b1' })]);
    act(() => r.result.current.setScrolleando(true));
    emit(fake.channels[0], payload('UPDATE', { id: 'b1', estado: 'recarga', cliente_id: 'cliente-a' }));
    expect(r.result.current.pendientes).toBe(1);

    act(() => r.result.current.aplicarPendientes());
    expect(r.result.current.pendientes).toBe(0);
    // Snapshot released: b1 now reflected in the gated list.
    expect(r.result.current.porEstadoVisibles.recarga.map((g) => g.cliente_id)).toEqual(['cliente-a']);
  });

  it('counters stay live while a change is queued (MOD-17 S2)', async () => {
    const r = await cargar([botellon({ id: 'b1' }), botellon({ id: 'b2', cliente_id: 'cliente-b' })]);
    act(() => r.result.current.setScrolleando(true));
    emit(fake.channels[0], payload('UPDATE', { id: 'b1', estado: 'recarga', cliente_id: 'cliente-a' }));
    // Live counter updated immediately even though the change is queued.
    expect(r.result.current.porEstado.recibido.length).toBe(1);
    expect(r.result.current.porEstado.recarga.length).toBe(1);
  });

  it('DELETE removes the row from the live list (REQ-COS-27)', async () => {
    const r = await cargar([botellon({ id: 'b1' }), botellon({ id: 'b2', cliente_id: 'cliente-b' })]);
    emit(fake.channels[0], payload('DELETE', { id: 'b1' }));
    expect(r.result.current.porEstado.recibido.map((g) => g.cliente_id)).toEqual(['cliente-b']);
  });

  it('unknown-client INSERT triggers one refetch (D5)', async () => {
    getColaOperacionesMock.mockResolvedValueOnce([botellon({ id: 'b1' })]);
    const r = renderHook(() => useColaOperaciones({ tab: 'recibido' }));
    await act(async () => {});
    expect(getColaOperacionesMock).toHaveBeenCalledTimes(1);

    getColaOperacionesMock.mockResolvedValueOnce([
      botellon({ id: 'b1' }),
      botellon({ id: 'nuevo', codigo: 'BOT-NEW', cliente_id: 'cliente-nuevo', estado: 'recibido' }),
    ]);
    emit(fake.channels[0], payload('INSERT', { id: 'nuevo', estado: 'recibido', cliente_id: 'cliente-nuevo' }));
    await act(async () => {});
    expect(getColaOperacionesMock).toHaveBeenCalledTimes(2);
    expect(r.result.current.porEstado.recibido.map((g) => g.cliente_id)).toEqual(['cliente-a', 'cliente-nuevo']);
  });

  it('echo suppression: an event for an id this client is moving does NOT queue (D6)', async () => {
    const r = await cargar([botellon({ id: 'b1' })]);
    // mover() adds the id to the in-flight set synchronously (RPC pending).
    void r.result.current.mover(['b1'], 'recarga');
    // Echo of this client's own move arrives before the RPC settles.
    emit(fake.channels[0], payload('UPDATE', { id: 'b1', estado: 'recarga', cliente_id: 'cliente-a' }));
    expect(r.result.current.pendientes).toBe(0);
  });

  it('entrando: a card newly entering the active tab gets data-entrada and clears after 1200ms (D9)', async () => {
    vi.useFakeTimers();
    // cliente-a starts in recarga; active tab is recibido. Moving b1 into
    // recibido makes cliente-a's card NEW in the active tab → outline.
    getColaOperacionesMock.mockResolvedValue([
      botellon({ id: 'b1', estado: 'recarga', cliente_id: 'cliente-a' }),
      botellon({ id: 'b2', estado: 'recibido', cliente_id: 'cliente-b' }),
    ]);
    const r = renderHook(() => useColaOperaciones({ tab: 'recibido' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(r.result.current.entrando.has('cliente-a')).toBe(false);

    // Queued (scrolling): b1 enters recibido live, snapshot frozen with it still in recarga.
    act(() => r.result.current.setScrolleando(true));
    emit(fake.channels[0], payload('UPDATE', { id: 'b1', estado: 'recibido', cliente_id: 'cliente-a' }));
    expect(r.result.current.pendientes).toBe(1);

    // Chip tap applies → cliente-a's card is new in the active tab → outlined.
    act(() => r.result.current.aplicarPendientes());
    expect(r.result.current.entrando.has('cliente-a')).toBe(true);

    // Clears after 1200ms.
    act(() => { vi.advanceTimersByTime(1200); });
    expect(r.result.current.entrando.has('cliente-a')).toBe(false);
  });
});
