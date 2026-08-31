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

import { subirFotosCliente, eliminarFotoCliente } from '@/lib/db/fotos';
import { revalidatePath } from 'next/cache';

// ── Supabase chain mock ──
// Mismo patrón que crear-cliente.test.ts (chain thenable por escenario).

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

function makeSupabase(queue: Chain[], storage?: ReturnType<typeof makeStorage>) {
  const supabase = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    from: vi.fn((_table: string) => {
      const chain = queue.shift();
      if (!chain) throw new Error(`Unexpected from() call — queue exhausted`);
      return chain;
    }),
    ...(storage ? { storage } : {}),
  };
  return supabase;
}

/** Mock de `supabase.storage.from(bucket)`: expone upload (subir) y remove (quitar). */
function makeStorage() {
  const rutas: string[] = [];
  const upload = vi.fn(async (_ruta: string) => {
    rutas.push(_ruta);
    return { error: null };
  });
  const remove = vi.fn(async () => ({ error: null }));
  return {
    rutas,
    remove,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    from: vi.fn((_bucket: string) => ({ upload, remove })),
  };
}

beforeEach(() => {
  createClientMock.mockReset();
  vi.mocked(revalidatePath).mockClear();
});

describe('subirFotosCliente — subida de fotos a un cliente existente', () => {
  it('sube cada foto a fachadas/{clienteId}/ y registra la fila en fotos_clientes', async () => {
    const insert = makeChain(async () => ({ data: null, error: null }));
    const storage = makeStorage();
    const supabase = makeSupabase([insert], storage);
    createClientMock.mockResolvedValue(supabase);

    const fd = new FormData();
    fd.append('fotos', new File(['data'], 'fachada.jpg', { type: 'image/jpeg' }));

    const result = await subirFotosCliente('c1', null, fd);

    expect(result).toEqual({ success: true });
    expect(storage.from).toHaveBeenCalledWith('fotos-clientes');
    expect(storage.rutas[0]).toMatch(/^fachadas\/c1\//);
    expect(storage.from('fotos-clientes').upload).toHaveBeenCalledWith(
      storage.rutas[0],
      expect.any(File),
      { contentType: 'image/jpeg' }
    );
    expect(insert.insert).toHaveBeenCalledWith({
      cliente_id: 'c1',
      tipo: 'fachada',
      ruta_storage: storage.rutas[0],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/clientes/c1');
  });

  it('sube múltiples archivos en un solo form', async () => {
    const insert1 = makeChain(async () => ({ data: null, error: null }));
    const insert2 = makeChain(async () => ({ data: null, error: null }));
    const storage = makeStorage();
    const supabase = makeSupabase([insert1, insert2], storage);
    createClientMock.mockResolvedValue(supabase);

    const fd = new FormData();
    fd.append('fotos', new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
    fd.append('fotos', new File(['b'], 'b.png', { type: 'image/png' }));

    const result = await subirFotosCliente('c1', null, fd);

    expect(result).toEqual({ success: true });
    expect(storage.rutas).toHaveLength(2);
    expect(insert1.insert).toHaveBeenCalled();
    expect(insert2.insert).toHaveBeenCalled();
  });

  it('devuelve error si TODAS las fotos fallan la validación de tipo', async () => {
    const storage = makeStorage();
    const supabase = makeSupabase([], storage);
    createClientMock.mockResolvedValue(supabase);

    const fd = new FormData();
    fd.append('fotos', new File(['nota'], 'nota.txt', { type: 'text/plain' }));

    const result = await subirFotosCliente('c1', null, fd);

    expect(result).toEqual({ success: false, error: 'Las fotos no se pudieron subir.' });
    expect(storage.from('fotos-clientes').upload).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('sin archivos no toca la base y reporta éxito', async () => {
    const storage = makeStorage();
    const supabase = makeSupabase([], storage);
    createClientMock.mockResolvedValue(supabase);

    const result = await subirFotosCliente('c1', null, new FormData());

    expect(result).toEqual({ success: true });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('eliminarFotoCliente — quitar una foto', () => {
  it('borra el objeto del bucket y la fila de fotos_clientes', async () => {
    const del = makeChain(async () => ({ data: null, error: null }));
    const storage = makeStorage();
    const supabase = makeSupabase([del], storage);
    createClientMock.mockResolvedValue(supabase);

    const fd = new FormData();
    fd.append('foto_id', 'f-1');
    fd.append('ruta', 'fachadas/c1/123.jpg');

    const result = await eliminarFotoCliente('c1', null, fd);

    expect(result).toEqual({ success: true });
    expect(storage.from).toHaveBeenCalledWith('fotos-clientes');
    expect(storage.remove).toHaveBeenCalledWith(['fachadas/c1/123.jpg']);
    expect(del.delete).toHaveBeenCalled();
    expect(del.eq).toHaveBeenCalledWith('id', 'f-1');
    expect(revalidatePath).toHaveBeenCalledWith('/clientes/c1');
  });

  it('exige el id de la foto', async () => {
    const storage = makeStorage();
    const supabase = makeSupabase([], storage);
    createClientMock.mockResolvedValue(supabase);

    const result = await eliminarFotoCliente('c1', null, new FormData());

    expect(result).toEqual({ success: false, error: 'Falta el ID de la foto' });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});