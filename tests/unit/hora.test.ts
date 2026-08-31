import { describe, it, expect } from 'vitest';
import {
  ZONA_NEGOCIO,
  formatFechaZona,
  formatHoraZona,
  hoyZona,
  horaAhoraZona,
} from '@/lib/utils/hora';

// The business zone is Venezuela (fixed UTC-4, no DST). Every assertion here
// passes an explicit timeZone to `Intl`, so results are deterministic no
// matter which zone the test runner runs in.

describe('formatFechaZona', () => {
  it('renders YYYY-MM-DD in the business zone for a fixed UTC instant', () => {
    // 2026-08-28 23:30 UTC = 2026-08-28 19:30 Caracas (same calendar day).
    expect(formatFechaZona(new Date('2026-08-28T23:30:00Z'))).toBe('2026-08-28');
    // 2026-08-29 04:00 UTC = 2026-08-29 00:00 Caracas (midnight boundary).
    expect(formatFechaZona(new Date('2026-08-29T04:00:00Z'))).toBe('2026-08-29');
  });

  it('shifts the calendar day when the UTC day differs from Caracas', () => {
    // 2026-08-29 01:30 UTC = 2026-08-28 21:30 Caracas → previous day.
    expect(formatFechaZona(new Date('2026-08-29T01:30:00Z'))).toBe('2026-08-28');
    // 2026-08-29 03:59:59 UTC = 2026-08-28 23:59:59 Caracas → previous day.
    expect(formatFechaZona(new Date('2026-08-29T03:59:59Z'))).toBe('2026-08-28');
  });

  it('honors a custom timezone argument', () => {
    expect(formatFechaZona(new Date('2026-08-28T23:30:00Z'), 'UTC')).toBe('2026-08-28');
    expect(formatFechaZona(new Date('2026-08-29T01:30:00Z'), 'America/Caracas')).toBe('2026-08-28');
  });
});

describe('formatHoraZona', () => {
  it('renders HH:MM:SS in the business zone', () => {
    expect(formatHoraZona(new Date('2026-08-28T23:30:00Z'))).toBe('19:30:00');
    expect(formatHoraZona(new Date('2026-08-29T01:30:00Z'))).toBe('21:30:00');
  });

  it('normalizes midnight to 00:xx:xx instead of 24:xx:xx', () => {
    // 2026-08-29 04:30 UTC = 2026-08-29 00:30 Caracas.
    expect(formatHoraZona(new Date('2026-08-29T04:30:00Z'))).toBe('00:30:00');
  });
});

describe('hoyZona / horaAhoraZona', () => {
  it('match the output of the explicit formatters (consistent pair)', () => {
    const hoy = hoyZona();
    const hora = horaAhoraZona();
    expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hora).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    // Same instant → both helpers agree with the raw formatters.
    const ahora = new Date();
    expect(formatFechaZona(ahora)).toBe(hoy);
    expect(formatHoraZona(ahora)).toBe(hora);
  });

  it('ZONA_NEGOCIO is America/Caracas (UTC-4, no DST)', () => {
    expect(ZONA_NEGOCIO).toBe('America/Caracas');
    // Fixed offset proof: a summer and a winter instant share the same -04:00.
    const offset = (iso: string) =>
      new Intl.DateTimeFormat('en-US', { timeZone: ZONA_NEGOCIO, timeZoneName: 'shortOffset' })
        .formatToParts(new Date(iso))
        .find((p) => p.type === 'timeZoneName')?.value;
    expect(offset('2026-01-15T12:00:00Z')).toBe('GMT-4');
    expect(offset('2026-07-15T12:00:00Z')).toBe('GMT-4');
  });
});
