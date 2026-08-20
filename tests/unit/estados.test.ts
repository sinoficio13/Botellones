import { describe, it, expect } from 'vitest';
import { ESTADOS, ESTADO_LABELS, ESTADO_COLORS } from '@/lib/utils/estados';

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
