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

import { getBotellonByCodigo } from '@/lib/db/botellones';

type ChainBuilder = {
  select: Mock;
  eq: Mock;
  order: Mock;
  limit: Mock;
  single?: Mock;
  maybeSingle?: Mock;
};

function makeChain(terminal: { method: 'single' | 'maybeSingle'; result: () => Promise<unknown> }) {
  const b: ChainBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  b.select.mockReturnValue(b);
  b.eq.mockReturnValue(b);
  b.order.mockReturnValue(b);
  b.limit.mockReturnValue(b);
  b[terminal.method] = vi.fn(terminal.result);
  return b;
}

function makeSupabase(botellonRow: unknown, count: number, ultima: unknown) {
  const botellones = makeChain({ method: 'single', result: async () => ({ data: botellonRow }) });
  const recargasCount = {
    select: vi.fn(),
    eq: vi.fn(async () => ({ count })),
  };
  recargasCount.select.mockReturnValue(recargasCount);
  const recargasUltima = makeChain({
    method: 'maybeSingle',
    result: async () => ({ data: ultima }),
  });
  const queue = [recargasCount, recargasUltima];

  return {
    from: vi.fn((table: string) => (table === 'botellones' ? botellones : queue.shift())),
  };
}

describe('getBotellonByCodigo', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('returns id, cliente_id, and the summary fields WITHOUT the client name join', async () => {
    createClientMock.mockResolvedValue(
      makeSupabase(
        { id: 'b1', codigo: 'BOT-00001', estado: 'entregado', cliente_id: 'c1', clientes: { nombre: 'Juan Pérez' } },
        7,
        { fecha: '2024-01-15' }
      )
    );

    const result = await getBotellonByCodigo('BOT-00001');

    // The public-safe result carries no client personal data: the owner name
    // must never be serialized to the anonymous QR page.
    expect(result).toEqual({
      id: 'b1',
      codigo: 'BOT-00001',
      estado: 'entregado',
      cliente_id: 'c1',
      total_recargas: 7,
      ultima_recarga: '2024-01-15',
    });
    expect(result).not.toHaveProperty('clienteNombre');
  });

  it('does not select the clientes join at all', async () => {
    const supabase = makeSupabase(
      { id: 'b2', codigo: 'BOT-00002', estado: 'planta', cliente_id: 'c2' },
      3,
      null
    );
    createClientMock.mockResolvedValue(supabase);

    await getBotellonByCodigo('BOT-00002');

    // The botellones chain is the first `from` result; assert its select
    // projection never asks for the clientes relation.
    const botellonesChain = supabase.from.mock.results[0]?.value;
    const selectArg = botellonesChain.select.mock.calls[0][0] as string;
    expect(selectArg).not.toContain('clientes');
  });

  it('returns cliente_id null for an unassigned botellón', async () => {
    createClientMock.mockResolvedValue(
      makeSupabase({ id: 'b3', codigo: 'BOT-00003', estado: 'recibido', cliente_id: null, clientes: null }, 0, null)
    );

    const result = await getBotellonByCodigo('BOT-00003');

    expect(result?.cliente_id).toBeNull();
    expect(result?.id).toBe('b3');
    expect(result?.total_recargas).toBe(0);
  });

  it('returns null when no botellón matches the code', async () => {
    createClientMock.mockResolvedValue(makeSupabase(null, 0, null));

    await expect(getBotellonByCodigo('UNKNOWN')).resolves.toBeNull();
  });
});
