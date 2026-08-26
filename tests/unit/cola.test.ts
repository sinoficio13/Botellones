import { describe, it, expect } from 'vitest';
import { formatAntiguedad, nivelUrgencia, type NivelUrgencia } from '@/lib/utils/cola';

/**
 * cola.ts pure helpers — REQ-COS-18 (age/urgency).
 * Fixed ISO + injected `ahora` (design D8) keeps every case deterministic.
 * Format: <60min → "Nm"; 1–23h → "Nh" (rounded); ≥24h → "Nd" (rounded);
 * future timestamp clamps to 0. Urgency: <6h normal · 6–24h urgencia · >24h critica.
 */
function hace(horas: number, minutos = 0): { estadoDesde: string; ahora: Date } {
  const ahora = new Date('2026-08-26T12:00:00.000Z');
  const estadoDesde = new Date(ahora.getTime() - horas * 3_600_000 - minutos * 60_000).toISOString();
  return { estadoDesde, ahora };
}

describe('formatAntiguedad — REQ-COS-18 age matrix', () => {
  const MATRIZ: Array<[horas: number, minutos: number, esperado: string]> = [
    [0, 0, '0m'],
    [0, 45, '45m'],
    [0, 59, '59m'],
    [1, 0, '1h'],
    [3, 0, '3h'],
    [23, 0, '23h'],
    [24, 0, '1d'],
    [72, 0, '3d'],
  ];

  it.each(MATRIZ)('formats %ih %im as %s', (horas, minutos, esperado) => {
    const { estadoDesde, ahora } = hace(horas, minutos);
    expect(formatAntiguedad(estadoDesde, ahora)).toBe(esperado);
  });

  it('clamps a future timestamp to 0m', () => {
    const ahora = new Date('2026-08-26T12:00:00.000Z');
    const futuro = new Date(ahora.getTime() + 3_600_000).toISOString();
    expect(formatAntiguedad(futuro, ahora)).toBe('0m');
  });

  it('uses the current time when `ahora` is omitted', () => {
    const haceUnRato = new Date(Date.now() - 2 * 3_600_000).toISOString();
    expect(formatAntiguedad(haceUnRato)).toBe('2h');
  });
});

describe('nivelUrgencia — REQ-COS-18 urgency matrix', () => {
  const MATRIZ: Array<[horas: number, minutos: number, esperado: NivelUrgencia]> = [
    [5, 0, 'normal'],
    [6, 0, 'urgencia'],
    [24, 0, 'urgencia'],
    [24, 1, 'critica'],
    [30, 0, 'critica'],
  ];

  it.each(MATRIZ)('classifies %ih %im as %s', (horas, minutos, esperado) => {
    const { estadoDesde, ahora } = hace(horas, minutos);
    expect(nivelUrgencia(estadoDesde, ahora)).toBe(esperado);
  });

  it('classifies a future timestamp as normal (clamped to 0h)', () => {
    const ahora = new Date('2026-08-26T12:00:00.000Z');
    const futuro = new Date(ahora.getTime() + 60_000).toISOString();
    expect(nivelUrgencia(futuro, ahora)).toBe('normal');
  });
});