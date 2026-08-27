import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { getBotellonesCliente, type BotellonesClienteResult } from '@/lib/db/botellones';

/**
 * getBotellonesCliente — REQ-COS-29 (D14) server helper.
 * Returns the client row (id, nombre, cedula, telefono_1, whatsapp) + the
 * first `direcciones(*)` row + ALL botellones in ANY estado (no estado filter
 * → incl. `entregado`), each with `estado_desde`. Null-safe per repo
 * convention: any failure resolves the empty shape, never throws.
 */

type Cadena = {
  select: Mock;
  eq: Mock;
  maybeSingle: Mock;
};

/**
 * Query-builder chain: every method returns the chain, and the chain itself is
 * THENABLE (mirrors supabase-js: query builders are thenable, so `await
 * builder.eq(...)` resolves with the response). The clientes query chains
 * `.eq().maybeSingle()`, the botellones query awaits the `.eq(...)` result
 * directly — both must resolve through the same terminal.
 */
type CadenaThenable = Cadena & PromiseLike<unknown>;
function cadena(terminal: () => Promise<unknown>): CadenaThenable {
  const c = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(terminal),
    then: (
      onFulfilled?: ((value: unknown) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) => terminal().then(onFulfilled, onRejected),
  } as CadenaThenable;
  c.select.mockReturnValue(c);
  c.eq.mockReturnValue(c);
  return c;
}

/**
 * Supabase mock: `from` yields the clientes chain then the botellones chain
 * (both are awaited sequentially in the helper). `from` returns an array of
 * chains so each call takes the next one.
 */
function makeSupabase(cliente: unknown, botellones: unknown) {
  const cadenaCliente = cadena(async () => ({ data: cliente, error: null }));
  const cadenaBotellones = cadena(async () => ({ data: botellones, error: null }));
  const chains = [cadenaCliente, cadenaBotellones];
  let pos = 0;
  const supabase = {
    from: vi.fn(() => chains[pos++ % chains.length]),
  };
  return { supabase, cadenaCliente, cadenaBotellones };
}

function sinDatos(): BotellonesClienteResult {
  return { cliente: null, direccion: null, botellones: [] };
}

describe('getBotellonesCliente — REQ-COS-29 (D14)', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('queries the client with the direcciones join and ALL botellones (no estado filter)', async () => {
    const filaCliente = {
      id: 'cliente-1',
      nombre: 'Gimnasio Ríos',
      cedula: '12345678',
      telefono_1: '1144445555',
      whatsapp: '1144445555',
      direcciones: [{ calle: 'Av. Siempre Viva', ciudad: 'Caracas', estado: 'Miranda' }],
    };
    const { supabase, cadenaCliente, cadenaBotellones } = makeSupabase(filaCliente, [
      { id: 'b-1', codigo: 'BOT-001', estado: 'recibido', estado_desde: '2026-08-20T09:00:00.000Z' },
      { id: 'b-2', codigo: 'BOT-002', estado: 'entregado', estado_desde: '2026-08-19T09:00:00.000Z' },
    ]);
    createClientMock.mockResolvedValue(supabase);

    // This test asserts the QUERY CONTRACT (select/eq shape) — no need to
    // inspect the resolved value.
    await getBotellonesCliente('cliente-1');

    // Client query: the direcciones(*) embedded join + id filter, single row.
    expect(cadenaCliente.select).toHaveBeenCalledWith(
      expect.stringContaining('direcciones(*)')
    );
    expect(cadenaCliente.select).toHaveBeenCalledWith(
      expect.stringContaining('id, nombre, cedula, telefono_1, whatsapp')
    );
    expect(cadenaCliente.eq).toHaveBeenCalledWith('id', 'cliente-1');
    expect(cadenaCliente.maybeSingle).toHaveBeenCalled();

    // Bottles query: NO estado filter (all estados incl. entregado).
    expect(cadenaBotellones.eq).toHaveBeenCalledWith('cliente_id', 'cliente-1');
    expect(cadenaBotellones.select).toHaveBeenCalledWith('id, codigo, estado, estado_desde');
  });

  it('returns the client, the first direccion row and ALL estados incl. entregado', async () => {
    createClientMock.mockResolvedValue(
      makeSupabase(
        {
          id: 'cliente-1',
          nombre: 'Gimnasio Ríos',
          cedula: '12345678',
          telefono_1: '1144445555',
          whatsapp: '1144445555',
          direcciones: [{ calle: 'Av. Siempre Viva', ciudad: 'Caracas', estado: 'Miranda' }],
        },
        [
          { id: 'b-1', codigo: 'BOT-001', estado: 'recibido', estado_desde: '2026-08-20T09:00:00.000Z' },
          { id: 'b-2', codigo: 'BOT-002', estado: 'recarga', estado_desde: '2026-08-20T10:00:00.000Z' },
          { id: 'b-3', codigo: 'BOT-003', estado: 'listo', estado_desde: '2026-08-20T11:00:00.000Z' },
          { id: 'b-4', codigo: 'BOT-004', estado: 'delivery', estado_desde: '2026-08-20T12:00:00.000Z' },
          { id: 'b-5', codigo: 'BOT-005', estado: 'entregado', estado_desde: '2026-08-19T09:00:00.000Z' },
        ]
      ).supabase
    );

    const resultado = await getBotellonesCliente('cliente-1');

    expect(resultado.cliente).toEqual({
      id: 'cliente-1',
      nombre: 'Gimnasio Ríos',
      cedula: '12345678',
      telefono_1: '1144445555',
      whatsapp: '1144445555',
    });
    expect(resultado.direccion).toEqual({
      calle: 'Av. Siempre Viva',
      ciudad: 'Caracas',
      estado: 'Miranda',
    });
    // All five estados, including entregado — the ficha list covers everything.
    expect(resultado.botellones.map((b) => b.estado)).toEqual([
      'recibido',
      'recarga',
      'listo',
      'delivery',
      'entregado',
    ]);
    expect(resultado.botellones[4]).toEqual({
      id: 'b-5',
      codigo: 'BOT-005',
      estado: 'entregado',
      estado_desde: '2026-08-19T09:00:00.000Z',
    });
  });

  it('returns null cliente/direccion and empty botellones when the client is unknown', async () => {
    createClientMock.mockResolvedValue(makeSupabase(null, null).supabase);

    const resultado = await getBotellonesCliente('no-existe');

    expect(resultado).toEqual(sinDatos());
  });

  it('is null-safe: a transport failure resolves the empty shape, never throws', async () => {
    createClientMock.mockRejectedValue(new Error('network down'));

    const resultado = await getBotellonesCliente('cliente-1');

    expect(resultado).toEqual(sinDatos());
  });
});