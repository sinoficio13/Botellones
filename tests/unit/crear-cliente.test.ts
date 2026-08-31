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

import { createCliente } from '@/lib/db/clientes';
import { revalidatePath } from 'next/cache';

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
  'is',
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
      if (!chain) throw new Error(`Unexpected from() call — queue exhausted`);
      return chain;
    }),
  };
  return supabase;
}

function formBasico() {
  const fd = new FormData();
  fd.append('nombre', 'Ana López');
  fd.append('telefono_1', '584141234567');
  return fd;
}

beforeEach(() => {
  createClientMock.mockReset();
  vi.mocked(revalidatePath).mockClear();
});

describe('createCliente — asignación del botellón en un solo paso', () => {
  it('asigna el botellón SOLO cuando el checkbox está activo y el botellón sigue sin cliente', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const update = makeChain(async () => ({ error: null }));
    const supabase = makeSupabase([insert, update]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('botellon_id', 'b1');
    fd.append('asignar_botellon', 'on');

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
    // Cliente insertado primero, luego el update del botellón.
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'clientes');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'botellones');
    expect(update.update).toHaveBeenCalledWith({ cliente_id: 'c1' });
    expect(update.eq).toHaveBeenCalledWith('id', 'b1');
    // Guardia "nunca pisar un dueño existente": solo asigna si sigue null.
    expect(update.is).toHaveBeenCalledWith('cliente_id', null);
    expect(revalidatePath).toHaveBeenCalledWith('/clientes');
    expect(revalidatePath).toHaveBeenCalledWith('/botellones');
  });

  it('no toca botellones cuando el checkbox no llega en el form', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('botellon_id', 'b1');

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith('clientes');
    expect(revalidatePath).not.toHaveBeenCalledWith('/botellones');
    expect(revalidatePath).toHaveBeenCalledWith('/clientes');
  });

  it('no toca botellones cuando el checkbox viene desmarcado (sin "on")', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('botellon_id', 'b1');
    fd.append('asignar_botellon', '');

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalledWith('/botellones');
  });

  it('valida nombre y teléfono antes de tocar la base', async () => {
    const fd = new FormData();
    fd.append('nombre', '  ');
    fd.append('telefono_1', '584141234567');

    expect(await createCliente(null, fd)).toEqual({ error: 'El nombre es requerido' });
    expect(createClientMock).not.toHaveBeenCalled();

    const fd2 = new FormData();
    fd2.append('nombre', 'Ana');
    expect(await createCliente(null, fd2)).toEqual({ error: 'El teléfono es requerido' });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});