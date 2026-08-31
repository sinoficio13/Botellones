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

import { updateCliente } from '@/lib/db/clientes';
import { revalidatePath } from 'next/cache';

// ── Supabase chain mock ──
// Mismo patrón que crear-cliente.test.ts: cada builder devuelve el chain y el
// chain es thenable, así la expresión await resuelve al resultado del escenario.

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

function formEdicion() {
  const fd = new FormData();
  fd.append('id', 'c1');
  fd.append('nombre', 'Ana López');
  return fd;
}

beforeEach(() => {
  createClientMock.mockReset();
  vi.mocked(revalidatePath).mockClear();
});

describe('updateCliente — composición de tipo de documento (InputDocumento)', () => {
  it('compone tipo_documento J + dígitos → cedula "J-123456789"', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formEdicion();
    fd.append('tipo_documento', 'J');
    fd.append('cedula', '123456789');

    const result = await updateCliente(null, fd);

    expect(result).toEqual({ success: true, clienteId: 'c1' });
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ cedula: 'J-123456789' }));
    expect(revalidatePath).toHaveBeenCalledWith('/clientes/c1');
  });

  it('asume tipo V por defecto cuando no llega tipo_documento', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formEdicion();
    fd.append('cedula', '12345678');

    await updateCliente(null, fd);

    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ cedula: 'V-12345678' }));
  });

  it('guarda cedula null cuando no llegan dígitos', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    await updateCliente(null, formEdicion());

    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ cedula: null }));
  });
});

describe('updateCliente — composición de WhatsApp con país (InputWhatsapp)', () => {
  it('guarda WhatsApp extranjero: país 57 + "3001234567" → "573001234567"', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formEdicion();
    fd.append('pais_whatsapp', '57');
    fd.append('whatsapp', '3001234567');

    const result = await updateCliente(null, fd);

    expect(result).toEqual({ success: true, clienteId: 'c1' });
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ whatsapp: '573001234567' }));
  });

  it('asume país 58 y normaliza un número local venezolano', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formEdicion();
    fd.append('whatsapp', '04141234567');

    await updateCliente(null, fd);

    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ whatsapp: '584141234567' }));
  });

  it('guarda whatsapp null cuando el campo queda vacío', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formEdicion();
    fd.append('whatsapp', '  ');

    await updateCliente(null, fd);

    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ whatsapp: null }));
  });
});

describe('updateCliente — teléfono opcional y direccion_entrega', () => {
  it('permite guardar sin teléfono (telefono_1 null) y sin error', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    // formEdicion() no envía telefono_1.
    const result = await updateCliente(null, formEdicion());

    expect(result).toEqual({ success: true, clienteId: 'c1' });
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ telefono_1: null }));
  });

  it('guarda telefono_1 cuando llega', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formEdicion();
    fd.append('telefono_1', '04141234567');

    await updateCliente(null, fd);

    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ telefono_1: '04141234567' }));
  });

  it('guarda direccion_entrega recortada', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formEdicion();
    fd.append('direccion_entrega', '  Av. Principal, Edif. Ríos, Piso 2  ');

    await updateCliente(null, fd);

    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ direccion_entrega: 'Av. Principal, Edif. Ríos, Piso 2' })
    );
  });

  it('guarda direccion_entrega null cuando no llega', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    await updateCliente(null, formEdicion());

    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ direccion_entrega: null }));
  });
});

describe('updateCliente — columnas legacy preservadas vía hidden inputs', () => {
  it('forwardea telefono_2/tipo_cliente/horario/dias/contacto con su valor actual', async () => {
    const update = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([update]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formEdicion();
    fd.append('telefono_2', '02121234567');
    fd.append('tipo_cliente', 'Frecuente');
    fd.append('horario_preferido', 'Mañana');
    fd.append('dias_preferidos', 'Lun, Mié');
    fd.append('contacto_preferido', 'WhatsApp');
    fd.append('observaciones', '  Llamar antes de llegar  ');

    await updateCliente(null, fd);

    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({
        telefono_2: '02121234567',
        tipo_cliente: 'Frecuente',
        horario_preferido: 'Mañana',
        dias_preferidos: 'Lun, Mié',
        contacto_preferido: 'WhatsApp',
        observaciones: 'Llamar antes de llegar',
      })
    );
  });
});

describe('updateCliente — validaciones', () => {
  it('valida el nombre antes de tocar la base', async () => {
    const fd = formEdicion();
    fd.set('nombre', '  ');

    expect(await updateCliente(null, fd)).toEqual({ error: 'El nombre es requerido' });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('exige el id del cliente', async () => {
    const fd = new FormData();
    fd.append('nombre', 'Ana');

    expect(await updateCliente(null, fd)).toEqual({ error: 'ID de cliente no proporcionado' });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});