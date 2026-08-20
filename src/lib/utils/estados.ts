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

/**
 * Canonical human-readable labels for each botellon estado. Consumed by badges,
 * selects, and public pages. Falls back to the raw estado value when a key is
 * unknown (future estados must not crash the UI).
 */
export const ESTADO_LABELS: Record<string, string> = {
  recibido: 'Recibido',
  planta: 'En planta',
  recarga: 'En recarga',
  listo: 'Listo',
  delivery: 'En delivery',
  entregado: 'Entregado',
  danado: 'Dañado',
  perdido: 'Perdido',
  mantenimiento: 'Mantenimiento',
};

/**
 * Canonical badge color classes for each botellon estado. Contains both light
 * and dark-mode Tailwind variants. Unknown estados fall back to an empty string
 * (consumer renders without a colored badge).
 */
export const ESTADO_COLORS: Record<string, string> = {
  recibido: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-400',
  planta: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  recarga: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  listo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  delivery: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  entregado: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  danado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  perdido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  mantenimiento: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};
