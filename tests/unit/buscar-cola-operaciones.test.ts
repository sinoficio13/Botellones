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

import { buscarColaOperaciones, type ResultadoBusqueda } from '@/lib/db/botellones';
import { ESTADOS_KANBAN } from '@/lib/utils/estados';

/**
 * buscarColaOperaciones — REQ-COS-20 server-side parallel search.
 * nombre ilike / código ilike over the 4 queue estados (client-owned), plus a
 * cédula candidates fetch filtered in JS with digits-only normalization
 * (design D7 — PostgREST cannot regexp-normalize). Results grouped by match
 * type. The nombre chain selects `clientes!inner(...)` so the embedded filter
 * reduces top-level rows (PostgREST inner-join hint; see regression note in
 * the parallel-search test). The min-2 gate also lives server-side: short
 * queries never touch the DB.
 */

type Chain = {
  select: Mock;
  not: Mock;
  in: Mock;
  ilike: Mock;
  order: Mock;
};

/** supabase-js response shape: PostgREST errors RESOLVE as `{ data, error }`. */
type Respuesta = { data: unknown[] | null; error?: { message: string } | null };

/** Query-builder chain: every method returns the chain until `order` (terminal). */
function makeChain(terminal: () => Promise<Respuesta>): Chain {
  const b: Chain = {
    select: vi.fn(),
    not: vi.fn(),
    in: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(terminal),
  };
  b.select.mockReturnValue(b);
  b.not.mockReturnValue(b);
  b.in.mockReturnValue(b);
  b.ilike.mockReturnValue(b);
  return b;
}

/** Queue-shaped fixture row (ColaBotellon, cast — supabase returns loose rows). */
function botellon(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    codigo: `BOT-${id}`,
    estado: 'recibido',
    cliente_id: `cliente-${id}`,
    estado_desde: '2026-08-20T09:00:00.000Z',
    clientes: { nombre: `Cliente ${id}`, cedula: `12345${id}`, telefono_1: null, whatsapp: null },
    ...over,
  };
}

/**
 * Supabase mock: `from` yields the three chains in the order the helper builds
 * them — nombre ilike, código ilike, cédula candidates (Promise.all array
 * literal evaluation order). Chain groups cycle per `buscarColaOperaciones`
 * call (each search makes exactly 3 `from` calls), so one mock serves the
 * repeated searches in a single test. Each chain resolves either a plain row
 * array (treated as `data`) or a full supabase-js response `{ data, error }`
 * (for the PostgREST-error rejection cases).
 */
function makeSupabase(resultados: {
  nombre: unknown[] | Respuesta;
  codigo: unknown[] | Respuesta;
  candidatos: unknown[] | Respuesta;
}) {
  const aRespuesta = (r: unknown[] | Respuesta): Respuesta => (Array.isArray(r) ? { data: r } : r);
  const construir = () => [
    makeChain(async () => aRespuesta(resultados.nombre)),
    makeChain(async () => aRespuesta(resultados.codigo)),
    makeChain(async () => aRespuesta(resultados.candidatos)),
  ];
  const [nombre, codigo, candidatos] = construir();
  let grupo = [nombre, codigo, candidatos];
  let pos = 0;
  const supabase = {
    from: vi.fn(() => {
      const i = pos++ % 3;
      if (i === 0 && pos > 1) grupo = construir();
      return grupo[i];
    }),
  };
  return { supabase, nombre, codigo, candidatos };
}

function sinResultados(): ResultadoBusqueda {
  return { porNombre: [], porCedula: [], porCodigo: [] };
}

describe('buscarColaOperaciones — REQ-COS-20 server side', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('returns empty buckets without touching the DB for queries under 2 chars', async () => {
    const supabase = makeSupabase({ nombre: [], codigo: [], candidatos: [] });
    createClientMock.mockResolvedValue(supabase.supabase);

    await expect(buscarColaOperaciones('a')).resolves.toEqual(sinResultados());
    await expect(buscarColaOperaciones('')).resolves.toEqual(sinResultados());
    await expect(buscarColaOperaciones('  a  ')).resolves.toEqual(sinResultados());
    expect(supabase.supabase.from).not.toHaveBeenCalled();
  });

  it('runs three parallel searches over the client-owned queue estados', async () => {
    const { supabase, nombre, codigo, candidatos } = makeSupabase({
      nombre: [],
      codigo: [],
      candidatos: [],
    });
    createClientMock.mockResolvedValue(supabase);

    await buscarColaOperaciones('ma');

    expect(supabase.from).toHaveBeenCalledTimes(3);
    for (const cadena of [nombre, codigo, candidatos]) {
      expect(cadena.not).toHaveBeenCalledWith('cliente_id', 'is', null);
      expect(cadena.in).toHaveBeenCalledWith('estado', ESTADOS_KANBAN);
      expect(cadena.order).toHaveBeenCalledWith('estado_desde', { ascending: true });
    }
    // One chain filters by embedded client name, another by código (design R5).
    // REGRESSION NOTE (review finding): an embedded-resource filter
    // (`clientes.nombre` ilike) NEVER reduces top-level rows without PostgREST's
    // `!inner` hint — it returned the ENTIRE client-owned queue with
    // `clientes: null` on non-matching rows and crashed the Item render
    // (`b.clientes.nombre` TypeError). The `!inner` hint belongs in the SELECT
    // (`clientes!inner(nombre, ...)` — inner-join semantics: non-matching rows
    // excluded, join always present), NOT in the filter path:
    // `clientes!inner.nombre` errors 42703 on the project's PostgREST (verified
    // live). Lock the inner select on the nombre chain:
    expect(nombre.select).toHaveBeenCalledWith(expect.stringContaining('clientes!inner(nombre'));
    expect(nombre.ilike).toHaveBeenCalledWith('clientes.nombre', '%ma%');
    expect(codigo.ilike).toHaveBeenCalledWith('codigo', '%ma%');
    // The cédula candidates chain fetches the full bounded queue (no ilike).
    expect(candidatos.ilike).not.toHaveBeenCalled();
  });

  it('groups results by match type: nombre, código, cédula', async () => {
    const filaNombre = [botellon('1', { clientes: { nombre: 'María González' } })];
    const filaCodigo = [botellon('2', { codigo: 'BOT-MAR-2' })];
    const { supabase } = makeSupabase({
      nombre: filaNombre,
      codigo: filaCodigo,
      candidatos: [botellon('3')],
    });
    createClientMock.mockResolvedValue(supabase);

    const resultado = await buscarColaOperaciones('mar');

    expect(resultado.porNombre.map((b) => b.id)).toEqual(['1']);
    expect(resultado.porCodigo.map((b) => b.id)).toEqual(['2']);
    expect(resultado.porCedula).toEqual([]);
  });

  it('cédula bucket filters candidates by digits-only normalized match (spaces/leading zeros)', async () => {
    const { supabase } = makeSupabase({
      nombre: [],
      codigo: [],
      candidatos: [
        botellon('1', { clientes: { nombre: 'A', cedula: '12 345' } }),
        botellon('2', { clientes: { nombre: 'B', cedula: '0012345' } }),
        botellon('3', { clientes: { nombre: 'C', cedula: '999 999' } }),
        botellon('4', { clientes: { nombre: 'D', cedula: null } }),
      ],
    });
    createClientMock.mockResolvedValue(supabase);

    // Exact digits after normalization: both "12 345" and "0012345" → "12345".
    const exacto = await buscarColaOperaciones('12345');
    expect(exacto.porCedula.map((b) => b.id)).toEqual(['1', '2']);

    // Partial digits mirror ilike contains-semantics.
    const parcial = await buscarColaOperaciones('1234');
    expect(parcial.porCedula.map((b) => b.id)).toEqual(['1', '2']);

    // A non-digit query never fills the cédula bucket.
    const letras = await buscarColaOperaciones('ma');
    expect(letras.porCedula).toEqual([]);
  });

  it('rejects when any chain resolves a PostgREST error (db failure is not an empty result)', async () => {
    // supabase-js RESOLVES PostgREST errors as `{ data: null, error }` — it
    // never rejects, so without the review fix an unchecked `error` flowed
    // into the empty buckets and the Buscador rendered a false
    // 'Sin resultados para «q»'. The helper must throw so the server-action
    // promise rejects and the client `.catch` renders the error alert.
    const { supabase } = makeSupabase({
      nombre: { data: null, error: { message: 'db down' } },
      codigo: [],
      candidatos: [],
    });
    createClientMock.mockResolvedValue(supabase);

    await expect(buscarColaOperaciones('mar')).rejects.toThrow('db down');
  });
});