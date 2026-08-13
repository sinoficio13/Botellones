/**
 * Botellon lifecycle state machine — pure functions, no server-side deps.
 *
 * Ciclo físico del botellón:
 *   recibido → planta → recarga → listo → delivery → entregado
 * Excepciones (desde cualquier punto operativo): danado, perdido, mantenimiento
 * Restauración desde excepción: → planta
 */
export const ESTADOS = [
  'recibido',
  'planta',
  'recarga',
  'listo',
  'delivery',
  'entregado',
  'danado',
  'perdido',
  'mantenimiento',
] as const;
export type Estado = (typeof ESTADOS)[number];

const TRANSICIONES: Record<Estado, Estado[]> = {
  // Flujo lineal
  recibido: ['planta', 'danado', 'perdido'],
  planta: ['recarga', 'mantenimiento', 'danado', 'perdido'],
  recarga: ['listo', 'danado', 'mantenimiento'],
  listo: ['delivery', 'danado'],
  delivery: ['entregado', 'perdido', 'danado'],
  entregado: ['recibido', 'perdido'],
  // Excepciones → restaurar a planta
  danado: ['planta'],
  perdido: ['planta'],
  mantenimiento: ['planta'],
};

export function getTransiciones(estado: Estado): Estado[] {
  return TRANSICIONES[estado] || [];
}

/** Estados operativos (los que van en el kanban, sin "entregado" que vive en circulación) */
export const ESTADOS_KANBAN: Estado[] = ['recibido', 'planta', 'recarga', 'listo', 'delivery'];

/** Excepciones (dañado/perdido/mantenimiento) */
export const ESTADOS_EXCEPCION: Estado[] = ['danado', 'perdido', 'mantenimiento'];
