import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createBotellon, updateBotellon, moverBotellon } from '@/lib/db/botellones';

// ── Supabase chain mock ──
// Mirrors supabase-js semantics: every builder method returns the chain and
// the chain is thenable, so the awaited expression resolves to the scenario
// result regardless of how many builder calls precede the await.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Chain = Record<string, any> & {
  then: (resolve: (value: unknown) => void, reject: (reason?: unknown) => void) => void;
};

const BUILDER_METHODS = [
  'select',
  'eq',
  'in',
  'order',
  'limit',
  'insert',
  'update',
  'delete',
  'range',
  'ilike',
  'or',
  'gte',
  'lte',
  'not',
  'single',
  'maybeSingle',
];

function makeChain(result: () => Promise<Record<string, unknown>>): Chain {
  const q = {} as Chain;
  for (const m of BUILDER_METHODS) {
    q[m] = vi.fn().mockReturnValue(q);
  }
  q.then = (resolve, reject) => {
    result().then(resolve, reject);
  };
  return q;
}

function makeSupabase(queue: Chain[]) {
  const supabase = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    from: vi.fn((_table: string) => {
      const chain = queue.shift();
      if (!chain) throw new Error('Unexpected from() call — queue exhausted');
      return chain;
    }),
  };
  return { supabase };
}

// R4 S4 — "No planta auto-assign on create": a botellon created with no estado
// gets the DB default 'recibido' (migration 0005) and no cliente. The insert
// payload must carry neither — that is what makes a new botellon stock.

describe('createBotellon — R4 S4 (default estado, no planta branch)', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('inserts an empty row so the DB default estado (recibido) applies — no estado, no cliente', async () => {
    const chain = makeChain(async () => ({ data: { id: 'b-new' }, error: null }));
    const { supabase } = makeSupabase([chain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await createBotellon(null, new FormData());

    expect(chain.insert).toHaveBeenCalledWith({});
    expect(chain.insert.mock.calls[0][0]).not.toHaveProperty('estado');
    expect(chain.insert.mock.calls[0][0]).not.toHaveProperty('cliente_id');
    expect(result).toEqual({ id: 'b-new', success: true });
  });

  it('surfaces the insert error instead of pretending success', async () => {
    const chain = makeChain(async () => ({ data: null, error: { message: 'insert denied' } }));
    const { supabase } = makeSupabase([chain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await createBotellon(null, new FormData());

    expect(result).toEqual({ error: 'insert denied' });
  });
});

// R4 S2 — "Assigning a client sells the stock": updateBotellon with a
// cliente_id transitions the botellon to 'entregado' unconditionally.

describe('updateBotellon — R4 S2 (assign client → entregado)', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('assigning a client to a clientless botellon transitions it to entregado', async () => {
    const chain = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([chain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('cliente_id', 'c1');

    const result = await updateBotellon(null, form);

    expect(chain.update).toHaveBeenCalledWith({ cliente_id: 'c1', estado: 'entregado' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'b1');
    expect(result).toEqual({ success: true, id: 'b1' });
  });

  it('assigning a client overrides an explicit estado — entregado wins', async () => {
    const chain = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([chain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('estado', 'recibido');
    form.set('cliente_id', 'c1');

    const result = await updateBotellon(null, form);

    expect(chain.update).toHaveBeenCalledWith({ estado: 'entregado', cliente_id: 'c1' });
    expect(result.success).toBe(true);
  });
});

// R4 S3 — "Unassign leaves estado unchanged": clearing cliente_id must NOT
// route the botellon to planta or flip the estado — clientless botellones in
// recibido/listo are stock.

describe('updateBotellon — R4 S3 (unassign keeps estado)', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('clearing the client leaves the botellon in its current estado — listo stays listo', async () => {
    const chain = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([chain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('estado', 'listo');
    form.set('cliente_id', '');

    const result = await updateBotellon(null, form);

    expect(chain.update).toHaveBeenCalledWith({ estado: 'listo', cliente_id: null });
    expect(result).toEqual({ success: true, id: 'b1' });
  });

  it('unassigning without touching estado leaves the estado untouched', async () => {
    const chain = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([chain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('cliente_id', '');

    const result = await updateBotellon(null, form);

    expect(chain.update).toHaveBeenCalledWith({ cliente_id: null });
    expect(result.success).toBe(true);
  });
});

// R4 S1 — "Clientless botellon counts as stock": no client is required to hold
// a botellon in recibido/listo, and the client stays cleared.

describe('R4 S1 — clientless stock semantics', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('updateBotellon keeps a clientless botellon in listo without requiring a client', async () => {
    const chain = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([chain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('estado', 'listo');

    const result = await updateBotellon(null, form);

    expect(chain.update).toHaveBeenCalledWith({ estado: 'listo', cliente_id: null });
    expect(result.success).toBe(true);
  });

  it('moverBotellon to listo requires no client and does not touch cliente_id', async () => {
    const chain = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([chain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'listo');

    expect(chain.update).toHaveBeenCalledWith({ estado: 'listo' });
    expect(result).toEqual({ success: true, id: 'b1' });
  });

  it('moverBotellon to recibido clears the client — reintegro with no planta branch', async () => {
    const chain = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([chain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'recibido');

    const payload = chain.update.mock.calls[0][0];
    expect(payload).toMatchObject({ estado: 'recibido', cliente_id: null, fecha_entrega: null });
    expect(result).toEqual({ success: true, id: 'b1' });
  });
});

// R4 assign path via moverBotellon: entregado requires a client (kanban move).

describe('moverBotellon — entregado requires a client (R4 assign path)', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('rejects entregado without a client before touching the DB', async () => {
    const { supabase } = makeSupabase([]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'entregado');

    expect(result).toEqual({ error: 'Cliente requerido para entregar' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('assigns the client and stamps fecha_entrega when entregado has a client', async () => {
    const chain = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([chain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'entregado', 'c1');

    const payload = chain.update.mock.calls[0][0];
    expect(payload).toMatchObject({ estado: 'entregado', cliente_id: 'c1' });
    expect(payload.fecha_entrega).toEqual(expect.any(String));
    expect(result).toEqual({ success: true, id: 'b1' });
  });
});