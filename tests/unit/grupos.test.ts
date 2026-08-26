import { describe, it, expect } from 'vitest';
import { agrupar, type BotellonAgrupable } from '@/lib/utils/grupos';

/**
 * agrupar() grouping matrix — spec REQ-COS-6.
 * Group = cliente_id; group age = min(estado_desde); groups oldest-first;
 * codes oldest-first inside a group; tiebreak codigo asc; NULL key = stock group.
 * ISO timestamptz strings compare lexicographically, so a fixed Z-suffixed
 * format keeps the ordering assertions deterministic.
 */
function botellon(overrides: Partial<BotellonAgrupable>): BotellonAgrupable {
  return {
    id: 'id',
    codigo: 'BOT-000',
    estado: 'recibido',
    cliente_id: 'cliente-a',
    estado_desde: '2026-08-20T09:00:00.000Z',
    ...overrides,
  };
}

describe('agrupar — groups', () => {
  it('sorts groups oldest-first by group age (REQ-COS-6 S1)', () => {
    const grupos = agrupar([
      botellon({ id: 'hoy', cliente_id: 'cliente-hoy', estado_desde: '2026-08-26T10:00:00.000Z' }),
      botellon({ id: 'ayer', cliente_id: 'cliente-ayer', estado_desde: '2026-08-25T10:00:00.000Z' }),
    ]);
    expect(grupos.map((g) => g.cliente_id)).toEqual(['cliente-ayer', 'cliente-hoy']);
  });

  it('sets group age to the oldest member estado_desde (REQ-COS-6 S2)', () => {
    const grupos = agrupar([
      botellon({ id: 'medio', codigo: 'BOT-002', estado_desde: '2026-08-22T09:00:00.000Z' }),
      botellon({ id: 'viejo', codigo: 'BOT-001', estado_desde: '2026-08-20T09:00:00.000Z' }),
      botellon({ id: 'nuevo', codigo: 'BOT-003', estado_desde: '2026-08-24T09:00:00.000Z' }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].estado_desde).toBe('2026-08-20T09:00:00.000Z');
  });

  it('sorts member codes oldest-first inside the group (REQ-COS-6 S2)', () => {
    const grupos = agrupar([
      botellon({ id: 'medio', codigo: 'BOT-002', estado_desde: '2026-08-22T09:00:00.000Z' }),
      botellon({ id: 'viejo', codigo: 'BOT-001', estado_desde: '2026-08-20T09:00:00.000Z' }),
      botellon({ id: 'nuevo', codigo: 'BOT-003', estado_desde: '2026-08-24T09:00:00.000Z' }),
    ]);
    expect(grupos[0].botellones.map((b) => b.codigo)).toEqual(['BOT-001', 'BOT-002', 'BOT-003']);
  });

  it('breaks equal estado_desde ties by codigo ascending (REQ-COS-6 S4)', () => {
    const grupos = agrupar([
      botellon({ id: 'b', codigo: 'BOT-002', estado_desde: '2026-08-20T09:00:00.000Z' }),
      botellon({ id: 'a', codigo: 'BOT-001', estado_desde: '2026-08-20T09:00:00.000Z' }),
    ]);
    expect(grupos[0].botellones.map((b) => b.codigo)).toEqual(['BOT-001', 'BOT-002']);
  });

  it('keeps rows with cliente_id NULL in one stock group, never dropped (REQ-COS-6 S3)', () => {
    const grupos = agrupar([
      botellon({ id: 'stock-1', codigo: 'BOT-010', cliente_id: null }),
      botellon({ id: 'stock-2', codigo: 'BOT-011', cliente_id: null, estado_desde: '2026-08-19T09:00:00.000Z' }),
      botellon({ id: 'cliente-1', cliente_id: 'cliente-a' }),
    ]);
    const stock = grupos.find((g) => g.cliente_id === null);
    expect(stock).toBeDefined();
    expect(stock!.botellones.map((b) => b.id)).toEqual(['stock-2', 'stock-1']);
    expect(grupos.map((g) => g.botellones).flat()).toHaveLength(3);
  });

  it('is total: every input row lands in exactly one group (REQ-COS-6 total)', () => {
    const input = [
      botellon({ id: 'a1', cliente_id: 'cliente-a', estado_desde: '2026-08-20T09:00:00.000Z' }),
      botellon({ id: 'a2', cliente_id: 'cliente-a', estado_desde: '2026-08-21T09:00:00.000Z' }),
      botellon({ id: 'b1', cliente_id: 'cliente-b', estado_desde: '2026-08-22T09:00:00.000Z' }),
      botellon({ id: 's1', cliente_id: null, estado_desde: '2026-08-23T09:00:00.000Z' }),
      botellon({ id: 's2', cliente_id: null, estado_desde: '2026-08-24T09:00:00.000Z' }),
    ];
    const grupos = agrupar(input);
    const ids = grupos.map((g) => g.botellones.map((b) => b.id)).flat().sort();
    expect(ids).toEqual(input.map((b) => b.id).sort());
    expect(grupos).toHaveLength(3);
  });

  it('returns an empty array for empty input and a single group for one row', () => {
    expect(agrupar([])).toEqual([]);
    const unico = botellon({ id: 'unico', codigo: 'BOT-001' });
    const grupos = agrupar([unico]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].cliente_id).toBe('cliente-a');
    expect(grupos[0].botellones).toEqual([unico]);
  });

  it('orders equal-age groups deterministically with the stock (null) group last', () => {
    const grupos = agrupar([
      botellon({ id: 'stock', codigo: 'BOT-020', cliente_id: null, estado_desde: '2026-08-20T09:00:00.000Z' }),
      botellon({ id: 'cliente', codigo: 'BOT-021', cliente_id: 'cliente-a', estado_desde: '2026-08-20T09:00:00.000Z' }),
    ]);
    expect(grupos.map((g) => g.cliente_id)).toEqual(['cliente-a', null]);
  });
});