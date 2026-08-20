import { describe, it, expect } from 'vitest';
import { matchesFilter } from '@/components/mapa/mapa-clientes';
import type { ClienteMapa } from '@/lib/db/mapa';

function makeMarker(overrides: Partial<ClienteMapa> = {}): ClienteMapa {
  return {
    id: 'c1',
    nombre: 'María Pérez',
    negocio: 'Abasto El Centro',
    telefono_1: '04141234567',
    codigo: 'CLI-001',
    latitud: 10.0678,
    longitud: -69.3473,
    sector: 'Barrio Nuevo',
    urbanizacion: 'Los Sauces',
    ciudad: 'Barquisimeto',
    estado: 'Lara',
    calle: 'Calle 10',
    avenida: 'Av. Vargas',
    ...overrides,
  };
}

describe('matchesFilter', () => {
  it('returns true for an empty or whitespace query', () => {
    const m = makeMarker();
    expect(matchesFilter(m, '')).toBe(true);
    expect(matchesFilter(m, '   ')).toBe(true);
  });

  it('matches by client name (case-insensitive)', () => {
    expect(matchesFilter(makeMarker(), 'maría pérez')).toBe(true);
    expect(matchesFilter(makeMarker(), 'MARÍA PÉREZ')).toBe(true);
  });

  it('matches by codigo', () => {
    expect(matchesFilter(makeMarker(), 'cli-001')).toBe(true);
  });

  it('matches by negocio', () => {
    expect(matchesFilter(makeMarker(), 'abasto')).toBe(true);
  });

  it('matches by ciudad', () => {
    expect(matchesFilter(makeMarker(), 'barquisimeto')).toBe(true);
  });

  it('matches by sector', () => {
    expect(matchesFilter(makeMarker(), 'barrio nuevo')).toBe(true);
  });

  it('does not match a botellon estado string', () => {
    expect(matchesFilter(makeMarker(), 'activo')).toBe(false);
  });

  it('returns false when nothing matches', () => {
    expect(matchesFilter(makeMarker(), 'inexistente')).toBe(false);
  });
});