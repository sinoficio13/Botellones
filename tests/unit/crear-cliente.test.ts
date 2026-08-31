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

/**
 * Mock de `supabase.storage.from(bucket).upload(...)`. Registra las rutas para
 * poder asertar el prefijo `fachadas/{clienteId}/`. Cada llamada consume un
 * resultado de `uploadResults` (default: éxito).
 */
function makeStorage(uploadResults: Array<{ error: unknown }> = [{ error: null }]) {
  const rutas: string[] = [];
  const upload = vi.fn(async (_ruta: string) => {
    rutas.push(_ruta);
    return uploadResults.shift() ?? { error: null };
  });
  return {
    rutas,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    from: vi.fn((_bucket: string) => ({ upload })),
  };
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

describe('createCliente — normalización de WhatsApp y dirección de entrega', () => {
  it('guarda WhatsApp en formato internacional 58…', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('whatsapp', '04141234567');

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp: '584141234567' })
    );
  });

  it('deja intacto un WhatsApp ya normalizado (58…)', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('whatsapp', '584141234567');

    await createCliente(null, fd);

    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp: '584141234567' })
    );
  });

  it('cae al teléfono_1 normalizado cuando no llega WhatsApp', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    // formBasico() no envía whatsapp → el fallback usa telefono_1 normalizado.
    await createCliente(null, formBasico());

    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp: '584141234567' })
    );
  });

  it('guarda direccion_entrega recortada', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('direccion_entrega', '  Av. Principal, Edif. Ríos, Piso 2  ');

    await createCliente(null, fd);

    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ direccion_entrega: 'Av. Principal, Edif. Ríos, Piso 2' })
    );
  });

  it('guarda direccion_entrega null cuando no llega', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    await createCliente(null, formBasico());

    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ direccion_entrega: null }));
  });
});

describe('createCliente — composición de WhatsApp con país (InputWhatsapp)', () => {
  it.each([
    ['58', '04141234567', '584141234567'],
    ['58', '04121234567', '584121234567'],
    ['57', '3001234567', '573001234567'],
    ['57', '573001234567', '573001234567'],
  ])('compone país %s + número %s → %s', async (pais, numero, esperado) => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('pais_whatsapp', pais);
    fd.append('whatsapp', numero);

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp: esperado })
    );
  });

  it('asume país 58 cuando no llega pais_whatsapp', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('whatsapp', '04141234567');

    await createCliente(null, fd);

    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp: '584141234567' })
    );
  });
});

describe('createCliente — composición de tipo de documento (InputDocumento)', () => {
  it('compone V-12345678 por defecto con la cédula de persona natural', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('cedula', '12345678');

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ cedula: 'V-12345678' })
    );
  });

  it('compone J-123456789 para una persona jurídica', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('tipo_documento', 'J');
    fd.append('cedula', '123456789');

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ cedula: 'J-123456789' })
    );
  });

  it('guarda cedula null cuando no llegan dígitos', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    await createCliente(null, formBasico());

    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ cedula: null }));
  });
});

describe('createCliente — link de Google Maps + coordenadas → fila en direcciones', () => {
  it('inserta en direcciones cuando llegan link_mapa y coordenadas ocultas', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const dirInsert = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([insert, dirInsert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('link_mapa', 'https://maps.app.goo.gl/xyz');
    fd.append('latitud', '10.4806');
    fd.append('longitud', '-66.9036');

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'clientes');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'direcciones');
    expect(dirInsert.insert).toHaveBeenCalledWith({
      cliente_id: 'c1',
      link_mapa: 'https://maps.app.goo.gl/xyz',
      latitud: 10.4806,
      longitud: -66.9036,
    });
  });

  it('parsea las coordenadas del link server-side cuando no llegan lat/lng ocultos', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const dirInsert = makeChain(async () => ({ data: null, error: null }));
    const supabase = makeSupabase([insert, dirInsert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('link_mapa', 'https://www.google.com/maps?q=10.4806,-66.9036');

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
    expect(dirInsert.insert).toHaveBeenCalledWith({
      cliente_id: 'c1',
      link_mapa: 'https://www.google.com/maps?q=10.4806,-66.9036',
      latitud: 10.4806,
      longitud: -66.9036,
    });
  });

  it('no inserta en direcciones cuando falta link_mapa', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    await createCliente(null, formBasico());

    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('no inserta en direcciones cuando el link no tiene coordenadas parseables', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const supabase = makeSupabase([insert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('link_mapa', 'https://example.com/ubicacion-no-parseable');

    await createCliente(null, fd);

    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('un error al insertar en direcciones NO falla la creación del cliente', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const dirInsert = makeChain(async () => ({ data: null, error: new Error('boom') }));
    const supabase = makeSupabase([insert, dirInsert]);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('link_mapa', 'https://maps.app.goo.gl/xyz');
    fd.append('latitud', '10.4806');
    fd.append('longitud', '-66.9036');

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
  });
});

describe('createCliente — fotos de fachada (subida best-effort)', () => {
  it('sube cada foto a fachadas/{clienteId}/ y registra la fila en fotos_clientes', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const fotosInsert = makeChain(async () => ({ data: null, error: null }));
    const storage = makeStorage([{ error: null }]);
    const supabase = makeSupabase([insert, fotosInsert], storage);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('fotos', new File(['data'], 'fachada.jpg', { type: 'image/jpeg' }));

    const result = await createCliente(null, fd);

    expect(result).toEqual({ clienteId: 'c1', success: true });
    expect(storage.from).toHaveBeenCalledWith('fotos-clientes');
    expect(storage.rutas[0]).toMatch(/^fachadas\/c1\//);
    expect(storage.from('fotos-clientes').upload).toHaveBeenCalledWith(
      storage.rutas[0],
      expect.any(File),
      { contentType: 'image/jpeg' }
    );
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'clientes');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'fotos_clientes');
    expect(fotosInsert.insert).toHaveBeenCalledWith({
      cliente_id: 'c1',
      tipo: 'fachada',
      ruta_storage: storage.rutas[0],
    });
  });

  it('salta un archivo con tipo inválido sin tumbar la creación', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const storage = makeStorage();
    const supabase = makeSupabase([insert], storage);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('fotos', new File(['nota'], 'nota.txt', { type: 'text/plain' }));

    const result = await createCliente(null, fd);

    // El archivo inválido se salta: la creación sigue exitosa (aviso no bloqueante).
    expect(result).toEqual({
      clienteId: 'c1',
      success: true,
      avisoFotos: 'El cliente se creó, pero las fotos no se pudieron subir.',
    });
    expect(storage.from('fotos-clientes').upload).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('una subida fallida no falla la creación (y avisa via avisoFotos)', async () => {
    const insert = makeChain(async () => ({ data: { id: 'c1' }, error: null }));
    const storage = makeStorage([{ error: new Error('upload boom') }]);
    const supabase = makeSupabase([insert], storage);
    createClientMock.mockResolvedValue(supabase);

    const fd = formBasico();
    fd.append('fotos', new File(['data'], 'fachada.jpg', { type: 'image/jpeg' }));

    const result = await createCliente(null, fd);

    expect(result).toEqual({
      clienteId: 'c1',
      success: true,
      avisoFotos: 'El cliente se creó, pero las fotos no se pudieron subir.',
    });
    expect(storage.from('fotos-clientes').upload).toHaveBeenCalledTimes(1);
    // No hubo insert en fotos_clientes (la subida falló).
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});