/**
 * Botellon state machine — pure functions, no server-side deps.
 */
export const ESTADOS = ['disponible', 'asignado', 'en_recarga', 'mantenimiento', 'dañado', 'perdido'] as const;
export type Estado = (typeof ESTADOS)[number];

const TRANSICIONES: Record<Estado, Estado[]> = {
  disponible: ['asignado', 'mantenimiento', 'dañado', 'perdido'],
  asignado: ['en_recarga', 'disponible', 'perdido'],
  en_recarga: ['asignado', 'disponible', 'mantenimiento'],
  mantenimiento: ['disponible', 'dañado'],
  dañado: [],
  perdido: ['disponible'],
};

export function getTransiciones(estado: Estado): Estado[] {
  return TRANSICIONES[estado] || [];
}
