import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createClientMock, procesarLoyaltyMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  procesarLoyaltyMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Spy that calls through to the real helper so delegation can be asserted
// while real loyalty behavior still runs.
vi.mock('@/lib/db/loyalty', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/loyalty')>();
  procesarLoyaltyMock.mockImplementation(actual.procesarLoyalty);
  return { ...actual, procesarLoyalty: procesarLoyaltyMock };
});

import { procesarLoyalty, procesarLoyaltyConCompensacion, REALIZADA_POR_PLACEHOLDER } from '@/lib/db/loyalty';
import { registrarRecarga } from '@/lib/db/recargas';
import { registrarOperacion } from '@/lib/db/cargas';
import { revalidatePath } from 'next/cache';

const PLACEHOLDER = REALIZADA_POR_PLACEHOLDER;

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
});

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
  const recorded: Chain[] = [];
  const supabase = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    from: vi.fn((_table: string) => {
      const chain = queue.shift();
      if (!chain) throw new Error(`Unexpected from() call — queue exhausted`);
      recorded.push(chain);
      return chain;
    }),
  };
  return { supabase, recorded };
}

// Chains whose first select arg is '*' are the loyalty recargas-count queries.
function countQueries(recorded: Chain[]): Chain[] {
  return recorded.filter((c) => c.select?.mock.calls[0]?.[0] === '*');
}

// ── Task 1.1: procesarLoyalty ──

describe('procesarLoyalty', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    procesarLoyaltyMock.mockClear();
  });

  it('returns no premios when the client is far from a milestone', async () => {
    const count = makeChain(async () => ({ count: 7 }));
    const { supabase } = makeSupabase([count]);
    createClientMock.mockResolvedValue(supabase);

    const result = await procesarLoyalty(['c1'], PLACEHOLDER);

    expect(result).toEqual({ premios: [] });
    expect(count.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    expect(count.eq).toHaveBeenCalledWith('cliente_id', 'c1');
  });

  it('creates a premio at every 100 recargas and notifies with the actor id', async () => {
    const count = makeChain(async () => ({ count: 100 }));
    const premios = makeChain(async () => ({ data: { id: 'p1' }, error: null }));
    const cliente = makeChain(async () => ({ data: { nombre: 'Ana' }, error: null }));
    const notif = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([count, premios, cliente, notif]);
    createClientMock.mockResolvedValue(supabase);

    const result = await procesarLoyalty(['c1'], PLACEHOLDER);

    expect(result).toEqual({ premios: [{ nivel: 100, id: 'p1' }] });
    expect(premios.insert).toHaveBeenCalledWith({
      cliente_id: 'c1',
      nivel_recargas: 100,
      estado: 'pendiente',
      fecha_alcanzado: expect.any(String),
    });
    expect(notif.insert).toHaveBeenCalledWith({
      tipo: 'premio',
      titulo: '¡Ana alcanzó 100 recargas!',
      mensaje: 'Premio pendiente — nivel 100',
      usuario_id: PLACEHOLDER,
      cliente_id: 'c1',
    });
  });

  it('is idempotent when the premio already exists (unique index 23505)', async () => {
    const count = makeChain(async () => ({ count: 200 }));
    const premios = makeChain(async () => ({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    }));
    const { supabase } = makeSupabase([count, premios]);
    createClientMock.mockResolvedValue(supabase);

    const result = await procesarLoyalty(['c1'], PLACEHOLDER);

    expect(result).toEqual({ premios: [] });
    expect(premios.insert).toHaveBeenCalledTimes(1);
    expect(supabase.from.mock.calls.some(([table]) => table === 'notificaciones')).toBe(false);
  });

  it('fans out a premio_cerca notification to every perfil at 5-before-milestone', async () => {
    const count = makeChain(async () => ({ count: 95 }));
    const cliente = makeChain(async () => ({ data: { nombre: 'Ana' }, error: null }));
    const perfiles = makeChain(async () => ({ data: [{ id: 'u1' }, { id: 'u2' }], error: null }));
    const notif1 = makeChain(async () => ({ error: null }));
    const notif2 = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([count, cliente, perfiles, notif1, notif2]);
    createClientMock.mockResolvedValue(supabase);

    const result = await procesarLoyalty(['c1'], PLACEHOLDER);

    expect(result).toEqual({ premios: [] });
    expect(notif1.insert).toHaveBeenCalledWith({
      tipo: 'premio_cerca',
      titulo: '¡Ana está a 5 recargas del premio!',
      mensaje: 'Ana tiene 95 recargas. Le faltan 5 para el nivel 100.',
      usuario_id: 'u1',
      cliente_id: 'c1',
    });
    expect(notif2.insert).toHaveBeenCalledWith({
      tipo: 'premio_cerca',
      titulo: '¡Ana está a 5 recargas del premio!',
      mensaje: 'Ana tiene 95 recargas. Le faltan 5 para el nivel 100.',
      usuario_id: 'u2',
      cliente_id: 'c1',
    });
  });

  it('processes each distinct client only once', async () => {
    const count = makeChain(async () => ({ count: 1 }));
    const { supabase, recorded } = makeSupabase([count]);
    createClientMock.mockResolvedValue(supabase);

    const result = await procesarLoyalty(['c1', 'c1', 'c1'], PLACEHOLDER);

    expect(result).toEqual({ premios: [] });
    expect(countQueries(recorded)).toHaveLength(1);
    expect(count.eq).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('does not touch the database when given no clients', async () => {
    const result = await procesarLoyalty([], PLACEHOLDER);

    expect(result).toEqual({ premios: [] });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

// ── Task 1.3: procesarLoyaltyConCompensacion (loyalty + milestone compensation) ──

describe('procesarLoyaltyConCompensacion', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    procesarLoyaltyMock.mockClear();
  });

  it('runs loyalty once per distinct client and compensates crossed milestones', async () => {
    // loyalty count query (103 → no exact-multiple premio) + compensation count + crossed premio insert
    const countLoyalty = makeChain(async () => ({ count: 103 }));
    const countComp = makeChain(async () => ({ count: 103 }));
    const premioInsert = makeChain(async () => ({ data: { id: 'p100' }, error: null }));
    const { supabase, recorded } = makeSupabase([countLoyalty, countComp, premioInsert]);
    createClientMock.mockResolvedValue(supabase);

    const result = await procesarLoyaltyConCompensacion(['c1'], new Map([['c1', 5]]), PLACEHOLDER);

    // 98 + 5 = 103 → loyalty fires no premio, compensation crosses nivel 100
    expect(result).toEqual({ premios: [{ nivel: 100, id: 'p100' }] });
    // two recargas-count queries: one for loyalty, one for milestone compensation
    expect(countQueries(recorded)).toHaveLength(2);
    expect(countLoyalty.eq).toHaveBeenCalledWith('cliente_id', 'c1');
    expect(premioInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ cliente_id: 'c1', nivel_recargas: 100, estado: 'pendiente' })
    );
  });

  it('does not create a premio when the batch starts exactly at a milestone (100 + 5)', async () => {
    const countLoyalty = makeChain(async () => ({ count: 105 }));
    const countComp = makeChain(async () => ({ count: 105 }));
    const { supabase } = makeSupabase([countLoyalty, countComp]);
    createClientMock.mockResolvedValue(supabase);

    const result = await procesarLoyaltyConCompensacion(['c1'], new Map([['c1', 5]]), PLACEHOLDER);

    expect(result).toEqual({ premios: [] });
    expect(supabase.from).toHaveBeenCalledTimes(2); // loyalty count + compensation count, no premio insert
  });

  it('surfaces a loyaltyWarning when loyalty throws but still compensates', async () => {
    // loyalty's own count query rejects → procesarLoyalty throws → helper catches and warns
    const countLoyalty = makeChain(async () => {
      throw new Error('loyalty boom');
    });
    const countComp = makeChain(async () => ({ count: 103 }));
    const premioInsert = makeChain(async () => ({ data: { id: 'p100' }, error: null }));
    const { supabase } = makeSupabase([countLoyalty, countComp, premioInsert]);
    createClientMock.mockResolvedValue(supabase);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await procesarLoyaltyConCompensacion(['c1'], new Map([['c1', 5]]), PLACEHOLDER);

    expect(result.loyaltyWarning).toBe('loyalty boom');
    expect(result.premios).toEqual([{ nivel: 100, id: 'p100' }]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('is idempotent on duplicate crossed-premio insert (23505)', async () => {
    // beforeCount 100 (added 103), postCount 203 → crosses nivel 200 → duplicate insert swallowed
    const countLoyalty = makeChain(async () => ({ count: 203 }));
    const countComp = makeChain(async () => ({ count: 203 }));
    const premioDup = makeChain(async () => ({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    }));
    const { supabase } = makeSupabase([countLoyalty, countComp, premioDup]);
    createClientMock.mockResolvedValue(supabase);

    const result = await procesarLoyaltyConCompensacion(['c1'], new Map([['c1', 103]]), PLACEHOLDER);

    expect(result).toEqual({ premios: [] });
    expect(premioDup.insert).toHaveBeenCalledTimes(1);
  });

  it('does not touch the database when given no clients', async () => {
    const result = await procesarLoyaltyConCompensacion([], new Map(), PLACEHOLDER);

    expect(result).toEqual({ premios: [] });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

// ── Task 1.2: registrarRecarga refactor (approval + delegation) ──

describe('registrarRecarga', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    procesarLoyaltyMock.mockClear();
  });

  it('records the recarga, updates the botellón, and delegates loyalty to the helper', async () => {
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000000' } }));
    const insert = makeChain(async () => ({ error: null }));
    const update = makeChain(async () => ({ error: null }));
    const count = makeChain(async () => ({ count: 1 }));
    const { supabase } = makeSupabase([last, insert, update, count]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('cliente_id', 'c1');
    form.set('botellon_id', 'b1');

    const result = await registrarRecarga(null, form);

    expect(result.success).toBe(true);
    expect(result.premioGenerado).toBeUndefined();
    expect(insert.insert).toHaveBeenCalledTimes(1);
    expect(insert.insert.mock.calls[0][0]).toMatchObject({
      numero_registro: 'REC-000001',
      cliente_id: 'c1',
      botellon_id: 'b1',
      realizada_por: PLACEHOLDER,
    });
    expect(update.update).toHaveBeenCalledWith({ estado: 'recarga' });
    expect(update.eq).toHaveBeenCalledWith('id', 'b1');
    expect(update.eq).toHaveBeenCalledWith('estado', 'entregado');
    expect(procesarLoyaltyMock).toHaveBeenCalledWith(['c1'], PLACEHOLDER);
  });

  it('propagates a premio generated by the loyalty helper', async () => {
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000099' } }));
    const insert = makeChain(async () => ({ error: null }));
    const update = makeChain(async () => ({ error: null }));
    const count = makeChain(async () => ({ count: 100 }));
    const premios = makeChain(async () => ({ data: { id: 'p1' }, error: null }));
    const cliente = makeChain(async () => ({ data: { nombre: 'Ana' }, error: null }));
    const notif = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([last, insert, update, count, premios, cliente, notif]);
    createClientMock.mockResolvedValue(supabase);

    const form = new FormData();
    form.set('cliente_id', 'c1');
    form.set('botellon_id', 'b1');

    const result = await registrarRecarga(null, form);

    expect(result).toEqual({ success: true, premioGenerado: { nivel: 100, id: 'p1' } });
    expect(procesarLoyaltyMock).toHaveBeenCalledWith(['c1'], PLACEHOLDER);
    expect(revalidatePath).toHaveBeenCalledWith('/clientes');
    expect(revalidatePath).toHaveBeenCalledWith('/recargas');
    expect(revalidatePath).toHaveBeenCalledWith('/botellones');
  });
});

// ── Task 1.4/1.5: registrarOperacion — recarga branch (migrated from registrarCarga) ──

describe('registrarOperacion — recarga branch', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    procesarLoyaltyMock.mockClear();
  });

  const entregados = [
    { id: 'b1', codigo: 'BOT-00001', estado: 'entregado', cliente_id: 'c1' },
    { id: 'b2', codigo: 'BOT-00002', estado: 'entregado', cliente_id: 'c2' },
  ];

  it('happy path: N rows, sequential REC from one max+1, shared fecha/hora, one .in() update, loyalty once per distinct client', async () => {
    const partition = makeChain(async () => ({ data: entregados, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({
      data: [
        { id: 'r1', botellon_id: 'b1' },
        { id: 'r2', botellon_id: 'b2' },
      ],
      error: null,
    }));
    const update = makeChain(async () => ({ error: null }));
    const countC1 = makeChain(async () => ({ count: 1 }));
    const countC2 = makeChain(async () => ({ count: 1 }));
    const countC1Comp = makeChain(async () => ({ count: 1 }));
    const countC2Comp = makeChain(async () => ({ count: 1 }));
    const { supabase, recorded } = makeSupabase([
      partition,
      last,
      insert,
      update,
      countC1,
      countC2,
      countC1Comp,
      countC2Comp,
    ]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b1', 'b2'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(true);
    expect(result.items).toEqual([
      { botellonId: 'b1', codigo: 'BOT-00001', ok: true, recargaId: 'r1', numeroRegistro: 'REC-000043' },
      { botellonId: 'b2', codigo: 'BOT-00002', ok: true, recargaId: 'r2', numeroRegistro: 'REC-000044' },
    ]);

    // Single array insert with shared fecha/hora, sequential REC and placeholder actor
    expect(insert.insert).toHaveBeenCalledTimes(1);
    const rows = insert.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      numero_registro: 'REC-000043',
      cliente_id: 'c1',
      botellon_id: 'b1',
      fecha: '2026-08-20',
      hora: '14:30:00',
      realizada_por: PLACEHOLDER,
    });
    expect(rows[1]).toMatchObject({
      numero_registro: 'REC-000044',
      cliente_id: 'c2',
      botellon_id: 'b2',
      fecha: '2026-08-20',
      hora: '14:30:00',
      realizada_por: PLACEHOLDER,
    });

    // One .in() estado update entregado → recarga, guarded by recarga sources
    expect(update.update).toHaveBeenCalledTimes(1);
    expect(update.update).toHaveBeenCalledWith({ estado: 'recarga' });
    expect(update.in).toHaveBeenCalledWith('id', ['b1', 'b2']);
    expect(update.in).toHaveBeenCalledWith('estado', ['entregado', 'recibido']);

    // Loyalty ran once per distinct client (loyalty counts + milestone-compensation counts)
    expect(countQueries(recorded)).toHaveLength(4);
    expect(revalidatePath).toHaveBeenCalledWith('/clientes');
    expect(revalidatePath).toHaveBeenCalledWith('/recargas');
    expect(revalidatePath).toHaveBeenCalledWith('/botellones');
  });

  it('runs loyalty once when multiple items share the same client', async () => {
    const sameClient = [
      { id: 'b1', codigo: 'BOT-00001', estado: 'entregado', cliente_id: 'c1' },
      { id: 'b2', codigo: 'BOT-00002', estado: 'entregado', cliente_id: 'c1' },
    ];
    const partition = makeChain(async () => ({ data: sameClient, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({
      data: [
        { id: 'r1', botellon_id: 'b1' },
        { id: 'r2', botellon_id: 'b2' },
      ],
      error: null,
    }));
    const update = makeChain(async () => ({ error: null }));
    const countC1 = makeChain(async () => ({ count: 1 }));
    const countC1Comp = makeChain(async () => ({ count: 1 }));
    const { supabase, recorded } = makeSupabase([partition, last, insert, update, countC1, countC1Comp]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b1', 'b2'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(true);
    expect(countQueries(recorded)).toHaveLength(2);
  });

  it('records valid items and rejects invalid ones in the same batch', async () => {
    const mixed = [
      { id: 'b1', codigo: 'BOT-00001', estado: 'entregado', cliente_id: 'c1' },
      { id: 'b3', codigo: 'BOT-00003', estado: 'entregado', cliente_id: null },
    ];
    const partition = makeChain(async () => ({ data: mixed, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({ data: [{ id: 'r1', botellon_id: 'b1' }], error: null }));
    const update = makeChain(async () => ({ error: null }));
    const countC1 = makeChain(async () => ({ count: 1 }));
    const countC1Comp = makeChain(async () => ({ count: 1 }));
    const { supabase } = makeSupabase([partition, last, insert, update, countC1, countC1Comp]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b1', 'b3'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(true);
    expect(result.items).toEqual([
      { botellonId: 'b1', codigo: 'BOT-00001', ok: true, recargaId: 'r1', numeroRegistro: 'REC-000043' },
      { botellonId: 'b3', codigo: 'BOT-00003', ok: false, reason: 'sin-cliente' },
    ]);
    // only valid ids participate in the estado update
    expect(update.in).toHaveBeenCalledWith('id', ['b1']);
  });

  it('rejects clientless items with sin-cliente and writes zero rows', async () => {
    const partition = makeChain(async () => ({
      data: [{ id: 'b3', codigo: 'BOT-00003', estado: 'entregado', cliente_id: null }],
      error: null,
    }));
    const { supabase } = makeSupabase([partition]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b3'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(false);
    expect(result.items).toEqual([
      { botellonId: 'b3', codigo: 'BOT-00003', ok: false, reason: 'sin-cliente' },
    ]);
    expect(supabase.from).toHaveBeenCalledTimes(1); // only the partition select
    expect(procesarLoyaltyMock).not.toHaveBeenCalled();
  });

  it('rejects non-entregado items with the estado reason', async () => {
    const partition = makeChain(async () => ({
      data: [
        { id: 'b4', codigo: 'BOT-00004', estado: 'recarga', cliente_id: 'c1' },
        { id: 'b5', codigo: 'BOT-00005', estado: 'listo', cliente_id: 'c1' },
      ],
      error: null,
    }));
    const { supabase } = makeSupabase([partition]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b4', 'b5'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(false);
    expect(result.items).toEqual([
      { botellonId: 'b4', codigo: 'BOT-00004', ok: false, reason: 'estado-recarga' },
      { botellonId: 'b5', codigo: 'BOT-00005', ok: false, reason: 'estado-listo' },
    ]);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when every item is rejected', async () => {
    const partition = makeChain(async () => ({
      data: [
        { id: 'b3', codigo: 'BOT-00003', estado: 'entregado', cliente_id: null },
        { id: 'b4', codigo: 'BOT-00004', estado: 'recarga', cliente_id: 'c1' },
      ],
      error: null,
    }));
    const { supabase } = makeSupabase([partition]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b3', 'b4'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(false);
    expect(result.items).toEqual([
      { botellonId: 'b3', codigo: 'BOT-00003', ok: false, reason: 'sin-cliente' },
      { botellonId: 'b4', codigo: 'BOT-00004', ok: false, reason: 'estado-recarga' },
    ]);
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(procesarLoyaltyMock).not.toHaveBeenCalled();
  });

  it('deletes inserted rows and reports failure when the estado update fails', async () => {
    const partition = makeChain(async () => ({ data: entregados, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({
      data: [
        { id: 'r1', botellon_id: 'b1' },
        { id: 'r2', botellon_id: 'b2' },
      ],
      error: null,
    }));
    const update = makeChain(async () => ({ error: { message: 'update exploded' } }));
    const del = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([partition, last, insert, update, del]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b1', 'b2'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('update exploded');
    expect(result.items).toEqual([
      { botellonId: 'b1', codigo: 'BOT-00001', ok: false, reason: 'error' },
      { botellonId: 'b2', codigo: 'BOT-00002', ok: false, reason: 'error' },
    ]);
    // compensating delete of the inserted ids
    expect(del.delete).toHaveBeenCalledTimes(1);
    expect(del.in).toHaveBeenCalledWith('id', ['r1', 'r2']);
    // loyalty must not run after rollback
    expect(procesarLoyaltyMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reports failure without deleting anything when the insert itself fails', async () => {
    const partition = makeChain(async () => ({ data: entregados, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({ data: null, error: { message: 'insert exploded' } }));
    const { supabase } = makeSupabase([partition, last, insert]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b1', 'b2'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('insert exploded');
    expect(result.items).toEqual([
      { botellonId: 'b1', codigo: 'BOT-00001', ok: false, reason: 'error' },
      { botellonId: 'b2', codigo: 'BOT-00002', ok: false, reason: 'error' },
    ]);
    expect(procesarLoyaltyMock).not.toHaveBeenCalled();
  });

  it('keeps an already-normalized HH:MM:SS hora unchanged', async () => {
    const partition = makeChain(async () => ({ data: entregados, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({
      data: [
        { id: 'r1', botellon_id: 'b1' },
        { id: 'r2', botellon_id: 'b2' },
      ],
      error: null,
    }));
    const update = makeChain(async () => ({ error: null }));
    const countC1 = makeChain(async () => ({ count: 1 }));
    const countC2 = makeChain(async () => ({ count: 1 }));
    const countC1Comp = makeChain(async () => ({ count: 1 }));
    const countC2Comp = makeChain(async () => ({ count: 1 }));
    const { supabase } = makeSupabase([
      partition,
      last,
      insert,
      update,
      countC1,
      countC2,
      countC1Comp,
      countC2Comp,
    ]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b1', 'b2'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30:05' });

    const rows = insert.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0].hora).toBe('14:30:05');
    expect(rows[1].hora).toBe('14:30:05');
    expect(result.success).toBe(true);
  });

  it('rejects a botellon id that does not exist in the database', async () => {
    const partition = makeChain(async () => ({
      data: [{ id: 'b1', codigo: 'BOT-00001', estado: 'entregado', cliente_id: 'c1' }],
      error: null,
    }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({ data: [{ id: 'r1', botellon_id: 'b1' }], error: null }));
    const update = makeChain(async () => ({ error: null }));
    const countC1 = makeChain(async () => ({ count: 1 }));
    const countC1Comp = makeChain(async () => ({ count: 1 }));
    const { supabase } = makeSupabase([partition, last, insert, update, countC1, countC1Comp]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b1', 'ghost'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(true);
    expect(result.items).toEqual([
      { botellonId: 'b1', codigo: 'BOT-00001', ok: true, recargaId: 'r1', numeroRegistro: 'REC-000043' },
      { botellonId: 'ghost', codigo: 'ghost', ok: false, reason: 'error' },
    ]);
  });

  it('rejects an empty batch without touching the database', async () => {
    const result = await registrarOperacion({ botellonIds: [], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(false);
    expect(result.items).toEqual([]);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  // ── R4-1/R2-2: loyalty throw after commit must not fail the committed batch ──

it('keeps the batch success when loyalty throws, surfacing a loyaltyWarning', async () => {
    const partition = makeChain(async () => ({ data: entregados, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({
      data: [
        { id: 'r1', botellon_id: 'b1' },
        { id: 'r2', botellon_id: 'b2' },
      ],
      error: null,
    }));
    const update = makeChain(async () => ({ error: null }));
    // loyalty's own count query rejects → helper catches and surfaces the warning
    const countLoyalty = makeChain(async () => {
      throw new Error('loyalty boom');
    });
    const countC1Comp = makeChain(async () => ({ count: 2 }));
    const countC2Comp = makeChain(async () => ({ count: 2 }));
    const { supabase } = makeSupabase([
      partition,
      last,
      insert,
      update,
      countLoyalty,
      countC1Comp,
      countC2Comp,
    ]);
    createClientMock.mockResolvedValue(supabase);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await registrarOperacion({
      botellonIds: ['b1', 'b2'],
      operacion: 'recargar',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(true);
    expect(result.items.every((i) => i.ok)).toBe(true);
    expect(result.loyaltyWarning).toBe('loyalty boom');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  // ── R3-1: milestone-crossing premio on overshoot ──

  it('creates the crossed milestone premio when the batch overshoots it (98 + 5 = 103)', async () => {
    const cinco = [1, 2, 3, 4, 5].map((i) => ({
      id: `b${i}`,
      codigo: `BOT-0000${i}`,
      estado: 'entregado',
      cliente_id: 'c1',
    }));
    const partition = makeChain(async () => ({ data: cinco, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({
      data: cinco.map((c, i) => ({ id: `r${i + 1}`, botellon_id: c.id })),
      error: null,
    }));
    const update = makeChain(async () => ({ error: null }));
    // loyalty's own count: post-batch total 103 (98 before + 5 added)
    const countLoyalty = makeChain(async () => ({ count: 103 }));
    // compensation count: same total → beforeCount 98 → crosses nivel-100
    const countComp = makeChain(async () => ({ count: 103 }));
    const premioInsert = makeChain(async () => ({ data: { id: 'p100' }, error: null }));
    const { supabase } = makeSupabase([
      partition,
      last,
      insert,
      update,
      countLoyalty,
      countComp,
      premioInsert,
    ]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({
      botellonIds: ['b1', 'b2', 'b3', 'b4', 'b5'],
      operacion: 'recargar',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(true);
    expect(result.premios).toEqual([{ nivel: 100, id: 'p100' }]);
    expect(premioInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ cliente_id: 'c1', nivel_recargas: 100 })
    );
  });

  it('does not create a double premio when the batch starts exactly at a milestone (100 + 5)', async () => {
    const cinco = [1, 2, 3, 4, 5].map((i) => ({
      id: `b${i}`,
      codigo: `BOT-0000${i}`,
      estado: 'entregado',
      cliente_id: 'c1',
    }));
    const partition = makeChain(async () => ({ data: cinco, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({
      data: cinco.map((c, i) => ({ id: `r${i + 1}`, botellon_id: c.id })),
      error: null,
    }));
    const update = makeChain(async () => ({ error: null }));
    const countLoyalty = makeChain(async () => ({ count: 105 }));
    const countComp = makeChain(async () => ({ count: 105 }));
    const { supabase } = makeSupabase([partition, last, insert, update, countLoyalty, countComp]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({
      botellonIds: ['b1', 'b2', 'b3', 'b4', 'b5'],
      operacion: 'recargar',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(true);
    expect(result.premios).toBeUndefined();
  });

  // ── R3-2/R1-1/R4-2: deterministic max+1 read with id tie-breaker ──

  it('orders the max+1 read deterministically with an id tie-breaker', async () => {
    const partition = makeChain(async () => ({ data: entregados, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({
      data: [
        { id: 'r1', botellon_id: 'b1' },
        { id: 'r2', botellon_id: 'b2' },
      ],
      error: null,
    }));
    const update = makeChain(async () => ({ error: null }));
    const countC1Comp = makeChain(async () => ({ count: 1 }));
    const countC2Comp = makeChain(async () => ({ count: 1 }));
    const { supabase } = makeSupabase([partition, last, insert, update, countC1Comp, countC2Comp]);
    createClientMock.mockResolvedValue(supabase);

    await registrarOperacion({ botellonIds: ['b1', 'b2'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(last.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(last.order).toHaveBeenCalledWith('id', { ascending: false });
  });

  // ── R1-2/R3-5/R4-3: compensating delete error is logged ──

  it('logs a compensating delete error instead of silently discarding it', async () => {
    const partition = makeChain(async () => ({ data: entregados, error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({
      data: [
        { id: 'r1', botellon_id: 'b1' },
        { id: 'r2', botellon_id: 'b2' },
      ],
      error: null,
    }));
    const update = makeChain(async () => ({ error: { message: 'update exploded' } }));
    const del = makeChain(async () => ({ error: { message: 'delete failed' } }));
    const { supabase } = makeSupabase([partition, last, insert, update, del]);
    createClientMock.mockResolvedValue(supabase);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await registrarOperacion({ botellonIds: ['b1', 'b2'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls.some((args) => JSON.stringify(args).includes('delete failed'))).toBe(true);
    errorSpy.mockRestore();
  });

  // ── R1-5: dedupe + strict hora validation ──

  it('dedupes duplicate botellonIds so each botellon is processed once', async () => {
    const partition = makeChain(async () => ({ data: [entregados[0]], error: null }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({ data: [{ id: 'r1', botellon_id: 'b1' }], error: null }));
    const update = makeChain(async () => ({ error: null }));
    const countC1 = makeChain(async () => ({ count: 1 }));
    const countC1Comp = makeChain(async () => ({ count: 1 }));
    const { supabase } = makeSupabase([partition, last, insert, update, countC1, countC1Comp]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({ botellonIds: ['b1', 'b1'], operacion: 'recargar', fecha: '2026-08-20', hora: '14:30' });

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(partition.in).toHaveBeenCalledWith('id', ['b1']);
    expect(insert.insert.mock.calls[0][0]).toHaveLength(1);
    expect(update.in).toHaveBeenCalledWith('id', ['b1']);
  });

  it('rejects an invalid hora (out-of-range) with a clear error and no writes', async () => {
    const result = await registrarOperacion({ botellonIds: ['b1'], operacion: 'recargar', fecha: '2026-08-20', hora: '99:99' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/hora/i);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('rejects a non-time hora string with a clear error and no writes', async () => {
    const result = await registrarOperacion({ botellonIds: ['b1'], operacion: 'recargar', fecha: '2026-08-20', hora: 'foo' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/hora/i);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

// ── Task 1.4/1.5: registrarOperacion — pure operations (recibir / listo) ──

describe('registrarOperacion — pure operations', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    procesarLoyaltyMock.mockClear();
  });

  it('recibir performs a pure estado update with no recargas insert and no loyalty', async () => {
    const partition = makeChain(async () => ({
      data: [
        { id: 'b1', codigo: 'BOT-00001', estado: 'entregado', cliente_id: 'c1' },
        { id: 'b2', codigo: 'BOT-00002', estado: 'entregado', cliente_id: null },
      ],
      error: null,
    }));
    const update = makeChain(async () => ({ error: null }));
    const { supabase, recorded } = makeSupabase([partition, update]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({
      botellonIds: ['b1', 'b2'],
      operacion: 'recibir',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(true);
    // clientless item accepted in recibir, and ok items carry no recargaId/numeroRegistro
    expect(result.items).toEqual([
      { botellonId: 'b1', codigo: 'BOT-00001', ok: true },
      { botellonId: 'b2', codigo: 'BOT-00002', ok: true },
    ]);
    expect(update.update).toHaveBeenCalledWith({ estado: 'recibido' });
    expect(update.in).toHaveBeenCalledWith('id', ['b1', 'b2']);
    expect(update.in).toHaveBeenCalledWith('estado', ['entregado']);
    // no recargas table access at all, no loyalty count queries
    expect(supabase.from.mock.calls.some(([table]) => table === 'recargas')).toBe(false);
    expect(countQueries(recorded)).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith('/botellones');
  });

  it('listo performs a pure estado update from recarga, accepting a clientless botellon', async () => {
    const partition = makeChain(async () => ({
      data: [{ id: 'b1', codigo: 'BOT-00001', estado: 'recarga', cliente_id: null }],
      error: null,
    }));
    const update = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([partition, update]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({
      botellonIds: ['b1'],
      operacion: 'listo',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(true);
    expect(result.items).toEqual([{ botellonId: 'b1', codigo: 'BOT-00001', ok: true }]);
    expect(update.update).toHaveBeenCalledWith({ estado: 'listo' });
    expect(update.in).toHaveBeenCalledWith('estado', ['recarga']);
    expect(supabase.from.mock.calls.some(([table]) => table === 'recargas')).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith('/botellones');
  });

  it('recibir zero-write when every item is outside its sources', async () => {
    const partition = makeChain(async () => ({
      data: [
        { id: 'b4', codigo: 'BOT-00004', estado: 'recarga', cliente_id: 'c1' },
        { id: 'b5', codigo: 'BOT-00005', estado: 'listo', cliente_id: 'c1' },
      ],
      error: null,
    }));
    const { supabase } = makeSupabase([partition]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({
      botellonIds: ['b4', 'b5'],
      operacion: 'recibir',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(false);
    expect(result.items).toEqual([
      { botellonId: 'b4', codigo: 'BOT-00004', ok: false, reason: 'estado-recarga' },
      { botellonId: 'b5', codigo: 'BOT-00005', ok: false, reason: 'estado-listo' },
    ]);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('reports a pure-operation update failure with per-item error reasons and no compensation', async () => {
    const partition = makeChain(async () => ({
      data: [{ id: 'b1', codigo: 'BOT-00001', estado: 'entregado', cliente_id: 'c1' }],
      error: null,
    }));
    const update = makeChain(async () => ({ error: { message: 'update exploded' } }));
    const { supabase } = makeSupabase([partition, update]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({
      botellonIds: ['b1'],
      operacion: 'recibir',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('update exploded');
    expect(result.items).toEqual([
      { botellonId: 'b1', codigo: 'BOT-00001', ok: false, reason: 'error' },
    ]);
    // pure branch: no recargas insert to compensate, no loyalty, no revalidate
    expect(supabase.from.mock.calls.some(([table]) => table === 'recargas')).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ── Task 1.4/1.5: registrarOperacion — multi-source recarga + op-scoped no-client ──

describe('registrarOperacion — multi-source recarga', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    procesarLoyaltyMock.mockClear();
  });

  it('accepts a recibido source for recargar in one pass', async () => {
    const partition = makeChain(async () => ({
      data: [{ id: 'b6', codigo: 'BOT-00006', estado: 'recibido', cliente_id: 'c1' }],
      error: null,
    }));
    const last = makeChain(async () => ({ data: { numero_registro: 'REC-000042' }, error: null }));
    const insert = makeChain(async () => ({ data: [{ id: 'r6', botellon_id: 'b6' }], error: null }));
    const update = makeChain(async () => ({ error: null }));
    const countC1 = makeChain(async () => ({ count: 1 }));
    const countC1Comp = makeChain(async () => ({ count: 1 }));
    const { supabase } = makeSupabase([partition, last, insert, update, countC1, countC1Comp]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({
      botellonIds: ['b6'],
      operacion: 'recargar',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(true);
    expect(result.items).toEqual([
      { botellonId: 'b6', codigo: 'BOT-00006', ok: true, recargaId: 'r6', numeroRegistro: 'REC-000043' },
    ]);
    expect(update.update).toHaveBeenCalledWith({ estado: 'recarga' });
    expect(update.in).toHaveBeenCalledWith('estado', ['entregado', 'recibido']);
  });

  it('rejects a raced item whose estado left the recarga sources with estado-<estado>', async () => {
    const partition = makeChain(async () => ({
      data: [{ id: 'b7', codigo: 'BOT-00007', estado: 'recarga', cliente_id: 'c1' }],
      error: null,
    }));
    const { supabase } = makeSupabase([partition]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({
      botellonIds: ['b7'],
      operacion: 'recargar',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(false);
    expect(result.items).toEqual([
      { botellonId: 'b7', codigo: 'BOT-00007', ok: false, reason: 'estado-recarga' },
    ]);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});

describe('registrarOperacion — op-scoped no-client gate', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    procesarLoyaltyMock.mockClear();
  });

  it('recargar rejects a clientless botellon with sin-cliente', async () => {
    const partition = makeChain(async () => ({
      data: [{ id: 'b8', codigo: 'BOT-00008', estado: 'entregado', cliente_id: null }],
      error: null,
    }));
    const { supabase } = makeSupabase([partition]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({
      botellonIds: ['b8'],
      operacion: 'recargar',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(false);
    expect(result.items).toEqual([
      { botellonId: 'b8', codigo: 'BOT-00008', ok: false, reason: 'sin-cliente' },
    ]);
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(procesarLoyaltyMock).not.toHaveBeenCalled();
  });

  it('the same clientless botellon is accepted under recibir', async () => {
    const partition = makeChain(async () => ({
      data: [{ id: 'b8', codigo: 'BOT-00008', estado: 'entregado', cliente_id: null }],
      error: null,
    }));
    const update = makeChain(async () => ({ error: null }));
    const { supabase } = makeSupabase([partition, update]);
    createClientMock.mockResolvedValue(supabase);

    const result = await registrarOperacion({
      botellonIds: ['b8'],
      operacion: 'recibir',
      fecha: '2026-08-20',
      hora: '14:30',
    });

    expect(result.success).toBe(true);
    expect(result.items).toEqual([{ botellonId: 'b8', codigo: 'BOT-00008', ok: true }]);
    expect(update.in).toHaveBeenCalledWith('id', ['b8']);
  });
});

// ── Task 2.5: registrarCarga thin wrapper removed in commit 2 ──
// The page now calls `registrarOperacion` directly; the backward-compatible
// wrapper and its delegation test were dropped.