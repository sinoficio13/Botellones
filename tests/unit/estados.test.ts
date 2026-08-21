import { describe, it, expect } from 'vitest';
import {
  ESTADOS,
  ESTADO_LABELS,
  ESTADO_COLORS,
  getTransiciones,
  OPERACIONES,
  esTransicionValida,
  type Estado,
  type OperacionId,
} from '@/lib/utils/estados';

describe('estados shared maps', () => {
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

  it('falls back to the raw estado value for unknown states via lookup', () => {
    // The map itself should not contain arbitrary keys; consumers use `?? raw`.
    const unknown = 'estado-futuro';
    const label = ESTADO_LABELS[unknown] ?? unknown;
    const color = ESTADO_COLORS[unknown] ?? '';
    expect(label).toBe('estado-futuro');
    expect(color).toBe('');
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

  it('defines recargar → recarga requiring client and REC with two sources', () => {
    expect(OPERACIONES.recargar).toEqual({
      target: 'recarga',
      requiresCliente: true,
      createsRec: true,
      sources: ['entregado', 'recibido'],
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
    expect(esTransicionValida('entregado', 'recargar')).toBe(true);
    expect(esTransicionValida('recibido', 'recargar')).toBe(true);
    expect(esTransicionValida('recarga', 'listo')).toBe(true);
  });

  it('rejects a source estado outside the operation sources', () => {
    expect(esTransicionValida('recarga', 'recibir')).toBe(false);
    expect(esTransicionValida('listo', 'recargar')).toBe(false);
    expect(esTransicionValida('entregado', 'listo')).toBe(false);
    expect(esTransicionValida('recibido', 'listo')).toBe(false);
  });

  it('rejects exception estados not listed as sources', () => {
    expect(esTransicionValida('danado', 'recargar')).toBe(false);
    expect(esTransicionValida('perdido', 'listo')).toBe(false);
    expect(esTransicionValida('mantenimiento', 'recibir')).toBe(false);
  });
});

describe('getTransiciones multi-source recarga edges', () => {
  it('allows entregado → recarga in one pass', () => {
    expect(getTransiciones('entregado')).toContain('recarga');
  });

  it('allows recibido → recarga in one pass', () => {
    expect(getTransiciones('recibido')).toContain('recarga');
  });

  it('keeps the pre-existing entregado → recibido edge', () => {
    expect(getTransiciones('entregado')).toContain('recibido');
  });

  it('does not introduce a new botellon estado', () => {
    // The set of estados must stay exactly the canonical 9.
    expect(ESTADOS).toHaveLength(9);
  });
});
