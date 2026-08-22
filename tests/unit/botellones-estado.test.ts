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
//
// Writers now READ the current row first (SELECT estado, cliente_id) and then
// write with a CAS guard (.eq('id', id).eq('estado', actual).select()), so
// every update/move test queues TWO chains: [selectChain, updateChain].

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

/** SELECT chain returning the current row (estado + cliente_id). */
function selectActual(estado: string, clienteId: string | null = null): Chain {
  return makeChain(async () => ({ data: { estado, cliente_id: clienteId }, error: null }));
}

/** UPDATE chain: non-empty data ⇒ CAS hit (success). */
function updateOk(): Chain {
  return makeChain(async () => ({ data: [{ id: 'b1' }], error: null }));
}

// R4 S4 — "No planta auto-assign on create": a botellon created with no estado
// gets the DB default 'recibido' (migration 0005) and no cliente. The insert
// payload must carry neither — that is what makes a new botellon stock.
// createBotellon does NOT read the current row, so it queues a single chain.

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

// R4 S2 + MOD "Stock and assign/unassign semantics": assigning a client to a
// CLIENTLESS botellon is a machine-exempt sale accepting {entregado, recarga}
// (identity too), defaulting to 'entregado'. Both-set→assigned validates
// strictly (D7). Writers read the current row and CAS-guard the write.

describe('updateBotellon — sale exception (clientless → assigned, D7/GAP-2)', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('assigning a client to a clientless botellon defaults the destino to entregado (S9)', async () => {
    const selectChain = selectActual('listo');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('cliente_id', 'c1');

    const result = await updateBotellon(null, form);

    expect(updateChain.update).toHaveBeenCalledWith({ estado: 'entregado', cliente_id: 'c1' });
    // CAS guard: conditional write on the estado we read
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'b1');
    expect(updateChain.eq).toHaveBeenCalledWith('estado', 'listo');
    expect(result).toEqual({ success: true, id: 'b1' });
  });

  it('accepts an explicit sale destino of recarga — machine-exempt (S10)', async () => {
    const selectChain = selectActual('listo');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('estado', 'recarga');
    form.set('cliente_id', 'c1');

    const result = await updateBotellon(null, form);

    expect(updateChain.update).toHaveBeenCalledWith({ estado: 'recarga', cliente_id: 'c1' });
    expect(result.success).toBe(true);
  });

  it('defaults an invalid submitted destino to entregado — override semantics (GAP-2)', async () => {
    const selectChain = selectActual('listo');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('estado', 'recibido');
    form.set('cliente_id', 'c1');

    const result = await updateBotellon(null, form);

    expect(updateChain.update).toHaveBeenCalledWith({ estado: 'entregado', cliente_id: 'c1' });
    expect(result.success).toBe(true);
  });

  it('keeps the identity estado when the submitted sale destino equals the current estado (GAP-2)', async () => {
    const selectChain = selectActual('listo');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('estado', 'listo');
    form.set('cliente_id', 'c1');

    const result = await updateBotellon(null, form);

    expect(updateChain.update).toHaveBeenCalledWith({ estado: 'listo', cliente_id: 'c1' });
    expect(result.success).toBe(true);
  });

  it('validates strictly when a client is re-assigned on an already-assigned botellon (S11/R1-D7)', async () => {
    // Current row: entregado WITH client c1 → NOT clientless → strict machine.
    const selectChain = selectActual('entregado', 'c1');
    const { supabase } = makeSupabase([selectChain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('estado', 'recarga');
    form.set('cliente_id', 'c2');

    const result = await updateBotellon(null, form);

    expect(result).toEqual({ error: 'Transición no permitida: entregado → recarga' });
    expect(supabase.from).toHaveBeenCalledTimes(1); // SELECT only — zero writes
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
    const selectChain = selectActual('listo');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('estado', 'listo');
    form.set('cliente_id', '');

    const result = await updateBotellon(null, form);

    expect(updateChain.update).toHaveBeenCalledWith({ estado: 'listo', cliente_id: null });
    expect(result).toEqual({ success: true, id: 'b1' });
  });

  it('unassigning without touching estado leaves the estado untouched', async () => {
    const selectChain = selectActual('listo');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('cliente_id', '');

    const result = await updateBotellon(null, form);

    expect(updateChain.update).toHaveBeenCalledWith({ cliente_id: null });
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
    const selectChain = selectActual('listo');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('id', 'b1');
    form.set('estado', 'listo');

    const result = await updateBotellon(null, form);

    expect(updateChain.update).toHaveBeenCalledWith({ estado: 'listo', cliente_id: null });
    expect(result.success).toBe(true);
  });

  it('moverBotellon to listo requires no client and does not touch cliente_id', async () => {
    const selectChain = selectActual('recarga');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'listo');

    expect(updateChain.update).toHaveBeenCalledWith({ estado: 'listo' });
    expect(result).toEqual({ success: true, id: 'b1' });
  });

  it('moverBotellon to recibido clears the client — reintegro with no planta branch', async () => {
    const selectChain = selectActual('entregado', 'c1');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'recibido');

    const payload = updateChain.update.mock.calls[0][0];
    expect(payload).toMatchObject({ estado: 'recibido', cliente_id: null, fecha_entrega: null });
    expect(result).toEqual({ success: true, id: 'b1' });
  });
});

// R2 — Server-side validation with CAS guard (spec S5/S6/S7/S8).

describe('moverBotellon — server validation (spec R2)', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('rejects an invalid manual move with the exact error and zero writes (S5)', async () => {
    const selectChain = selectActual('recibido');
    const { supabase } = makeSupabase([selectChain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'listo');

    expect(result).toEqual({ error: 'Transición no permitida: recibido → listo' });
    expect(supabase.from).toHaveBeenCalledTimes(1); // SELECT only — no UPDATE chain queued
  });

  it('accepts both a forward move and its reversal (S6)', async () => {
    // Forward: recibido → recarga
    const fwdSelect = selectActual('recibido');
    const fwdUpdate = updateOk();
    const { supabase: fwdSupabase } = makeSupabase([fwdSelect, fwdUpdate]);
    createClientMock.mockResolvedValue(fwdSupabase);
    const fwd = await moverBotellon('b1', 'recarga');
    expect(fwdUpdate.update).toHaveBeenCalledWith({ estado: 'recarga' });
    expect(fwd).toEqual({ success: true, id: 'b1' });

    // Reversal: recarga → recibido
    const revSelect = selectActual('recarga');
    const revUpdate = updateOk();
    const { supabase: revSupabase } = makeSupabase([revSelect, revUpdate]);
    createClientMock.mockResolvedValue(revSupabase);
    const rev = await moverBotellon('b1', 'recibido');
    expect(revUpdate.update).toHaveBeenCalledWith({ estado: 'recibido', cliente_id: null, fecha_entrega: null });
    expect(rev).toEqual({ success: true, id: 'b1' });
  });

  it('detects a CAS miss via empty data and returns the same error string (S7/D4)', async () => {
    // Both operators read 'recibido'; the winner already moved it, so the
    // conditional .eq('estado','recibido') matches zero rows.
    const selectChain = selectActual('recibido');
    const missChain = makeChain(async () => ({ data: [], error: null }));
    const { supabase } = makeSupabase([selectChain, missChain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'recarga');

    expect(missChain.update).toHaveBeenCalledWith({ estado: 'recarga' });
    expect(missChain.eq).toHaveBeenCalledWith('id', 'b1');
    expect(missChain.eq).toHaveBeenCalledWith('estado', 'recibido'); // CAS guard on read estado
    expect(result).toEqual({ error: 'Transición no permitida: recibido → recarga' });
  });

  it('permits an identity move (S8)', async () => {
    const selectChain = selectActual('listo');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'listo');

    expect(updateChain.update).toHaveBeenCalledWith({ estado: 'listo' });
    expect(result).toEqual({ success: true, id: 'b1' });
  });

  it('rejects an invalid strict move before any write (S11)', async () => {
    const selectChain = selectActual('listo');
    const { supabase } = makeSupabase([selectChain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'recibido');

    expect(result).toEqual({ error: 'Transición no permitida: listo → recibido' });
    expect(supabase.from).toHaveBeenCalledTimes(1);
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
    const selectChain = selectActual('listo');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'entregado', 'c1');

    const payload = updateChain.update.mock.calls[0][0];
    expect(payload).toMatchObject({ estado: 'entregado', cliente_id: 'c1' });
    expect(payload.fecha_entrega).toEqual(expect.any(String));
    expect(result).toEqual({ success: true, id: 'b1' });
  });

  it('accepts a sale direct to recarga with a client — machine-exempt (S10)', async () => {
    const selectChain = selectActual('listo');
    const updateChain = updateOk();
    const { supabase } = makeSupabase([selectChain, updateChain]);
    createClientMock.mockResolvedValue(supabase);

    const result = await moverBotellon('b1', 'recarga', 'c1');

    const payload = updateChain.update.mock.calls[0][0];
    expect(payload).toMatchObject({ estado: 'recarga', cliente_id: 'c1' });
    expect(result).toEqual({ success: true, id: 'b1' });
  });
});