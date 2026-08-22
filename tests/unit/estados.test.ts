import { describe, it, expect } from 'vitest';
import {
  ESTADOS,
  ESTADOS_KANBAN,
  ESTADO_LABELS,
  ESTADO_COLORS,
  getTransiciones,
  getReversiones,
  getEstadosPermitidos,
  OPERACIONES,
  esTransicionValida,
  type Estado,
  type OperacionId,
} from '@/lib/utils/estados';

describe('estados shared maps', () => {
  it('defines exactly the five canonical estados of the pure cycle', () => {
    expect(ESTADOS).toHaveLength(5);
    expect(ESTADOS).toEqual(['entregado', 'recibido', 'recarga', 'listo', 'delivery']);
  });

  it('provides a label for every canonical estado', () => {
    // Assert each canonical estado has a human-readable label (not the raw key).
    for (const estado of ESTADOS) {
      expect(ESTADO_LABELS[estado]).toBeDefined();
      expect(ESTADO_LABELS[estado]).not.toBe(estado);
    }
    expect(ESTADO_LABELS['recarga']).toBe('En recarga');
    expect(ESTADO_LABELS['entregado']).toBe('Entregado');
  });

  it('provides a badge color class for every canonical estado', () => {
    for (const estado of ESTADOS) {
      expect(ESTADO_COLORS[estado]).toBeDefined();
      expect(ESTADO_COLORS[estado]).toContain('bg-');
    }
    expect(ESTADO_COLORS['recarga']).toContain('cyan');
  });

  it('does not carry labels or colors for removed estados', () => {
    for (const removed of ['planta', 'danado', 'perdido', 'mantenimiento'] as const) {
      expect(ESTADO_LABELS[removed]).toBeUndefined();
      expect(ESTADO_COLORS[removed]).toBeUndefined();
    }
  });

  it('falls back to the raw estado value for unknown states via lookup', () => {
    // The map itself should not contain arbitrary keys; consumers use `?? raw`.
    const unknown = 'estado-futuro';
    const label = ESTADO_LABELS[unknown] ?? unknown;
    const color = ESTADO_COLORS[unknown] ?? '';
    expect(label).toBe('estado-futuro');
    expect(color).toBe('');
  });
});

describe('TRANSICIONES cycle contract', () => {
  it('advances one edge per transition on the linear cycle', () => {
    expect(getTransiciones('entregado')).toEqual(['recibido']);
    expect(getTransiciones('recibido')).toEqual(['recarga']);
    expect(getTransiciones('recarga')).toEqual(['listo']);
  });

  it('splits at listo into delivery and loops delivery back to entregado', () => {
    expect(getTransiciones('listo')).toEqual(['entregado', 'delivery']);
    expect(getTransiciones('delivery')).toEqual(['entregado']);
  });

  it('no longer routes any estado through planta or exception estados', () => {
    for (const estado of ESTADOS) {
      expect(getTransiciones(estado)).not.toContain('planta');
      expect(getTransiciones(estado)).not.toContain('danado');
      expect(getTransiciones(estado)).not.toContain('perdido');
      expect(getTransiciones(estado)).not.toContain('mantenimiento');
    }
  });
});

describe('OPERACIONES', () => {
  it('defines recibir → recibido without client or REC', () => {
    expect(OPERACIONES.recibir).toEqual({
      target: 'recibido',
      requiresCliente: false,
      createsRec: false,
      sources: ['entregado'],
    });
  });

  it('defines recargar → recarga requiring client and REC with recibido as its only source', () => {
    expect(OPERACIONES.recargar).toEqual({
      target: 'recarga',
      requiresCliente: true,
      createsRec: true,
      sources: ['recibido'],
    });
  });

  it('defines listo → listo without client or REC', () => {
    expect(OPERACIONES.listo).toEqual({
      target: 'listo',
      requiresCliente: false,
      createsRec: false,
      sources: ['recarga'],
    });
  });

  it('covers every operation id with a valid target estado', () => {
    const ops: OperacionId[] = ['recibir', 'recargar', 'listo'];
    for (const op of ops) {
      expect(ESTADOS).toContain(OPERACIONES[op].target);
      expect(OPERACIONES[op].sources.length).toBeGreaterThan(0);
    }
  });
});

describe('esTransicionValida', () => {
  it('accepts a source estado inside the operation sources', () => {
    expect(esTransicionValida('entregado', 'recibir')).toBe(true);
    expect(esTransicionValida('recibido', 'recargar')).toBe(true);
    expect(esTransicionValida('recarga', 'listo')).toBe(true);
  });

  it('rejects a source estado outside the operation sources', () => {
    expect(esTransicionValida('recarga', 'recibir')).toBe(false);
    expect(esTransicionValida('listo', 'recargar')).toBe(false);
    expect(esTransicionValida('entregado', 'listo')).toBe(false);
    expect(esTransicionValida('recibido', 'listo')).toBe(false);
  });

  it('rejects the entregado → recargar one-pass shortcut', () => {
    expect(esTransicionValida('entregado', 'recargar')).toBe(false);
  });
});

describe('ESTADOS_KANBAN', () => {
  it('exposes exactly the four operative columns, without entregado or removed estados', () => {
    expect(ESTADOS_KANBAN).toEqual(['recibido', 'recarga', 'listo', 'delivery']);
  });
});

describe('REVERSIONES — undo one step (spec S1/S2)', () => {
  it('reverses the linear cycle edges exactly', () => {
    expect(getReversiones('recibido')).toEqual(['entregado']);
    expect(getReversiones('recarga')).toEqual(['recibido']);
    expect(getReversiones('listo')).toEqual(['recarga']);
  });

  it('reverses entregado into both listo and delivery (spec S2 exact set)', () => {
    expect(getReversiones('entregado')).toEqual(['listo', 'delivery']);
    expect(getReversiones('delivery')).toEqual(['listo']);
  });

  it('gives every estado at least one reversion — nothing is terminal (spec R1)', () => {
    for (const estado of ESTADOS) {
      expect(getReversiones(estado).length).toBeGreaterThan(0);
    }
  });
});

describe('getEstadosPermitidos — single manual-move rule (spec S3/R1)', () => {
  it('returns the dedup union of forward, reversal, and identity for entregado', () => {
    expect(getEstadosPermitidos('entregado')).toEqual(['recibido', 'listo', 'delivery', 'entregado']);
  });

  it('returns the dedup union without duplicates for a mid-cycle estado', () => {
    expect(getEstadosPermitidos('recibido')).toEqual(['recarga', 'entregado', 'recibido']);
    const result = getEstadosPermitidos('recibido');
    expect(new Set(result).size).toBe(result.length);
  });

  it('satisfies the inversion invariant for all estado pairs (spec S4)', () => {
    for (const a of ESTADOS) {
      for (const b of ESTADOS) {
        expect(getTransiciones(a).includes(b)).toBe(getReversiones(b).includes(a));
      }
    }
  });
});