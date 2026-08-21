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
  recibido: ['planta', 'recarga', 'danado', 'perdido'],
  planta: ['recarga', 'mantenimiento', 'danado', 'perdido'],
  recarga: ['listo', 'danado', 'mantenimiento'],
  listo: ['delivery', 'danado'],
  delivery: ['entregado', 'perdido', 'danado'],
  // Multi-source recarga: a returned botellon (entregado) or one already
  // received (recibido) advances to recarga in one pass (terminal op).
  entregado: ['recibido', 'recarga', 'perdido'],
  // Excepciones → restaurar a planta
  danado: ['planta'],
  perdido: ['planta'],
  mantenimiento: ['planta'],
};

export function getTransiciones(estado: Estado): Estado[] {
  return TRANSICIONES[estado] || [];
}

/**
 * Terminal operations of the carga scanner. Each operation maps a set of
 * source estados to a single target estado and declares whether it needs a
 * cliente_id (only recarga writes `recargas` rows) and whether it creates a
 * REC number. The server-side `.in('estado', sources)` guard in
 * `registrarOperacion` is the source of truth; the UI mirrors it via
 * `esTransicionValida` for live green/red badges.
 */
export type OperacionId = 'recibir' | 'recargar' | 'listo';

export const OPERACIONES: Record<
  OperacionId,
  { target: Estado; requiresCliente: boolean; createsRec: boolean; sources: Estado[] }
> = {
  recibir: { target: 'recibido', requiresCliente: false, createsRec: false, sources: ['entregado'] },
  recargar: { target: 'recarga', requiresCliente: true, createsRec: true, sources: ['entregado', 'recibido'] },
  listo: { target: 'listo', requiresCliente: false, createsRec: false, sources: ['recarga'] },
};

/**
 * Strict transition check: an operation is valid for a botellon only when its
 * current estado is one of the operation's declared source estados. Mirrors
 * the server-side `.in('estado', sources)` guard.
 */
export function esTransicionValida(estadoActual: Estado, op: OperacionId): boolean {
  return OPERACIONES[op].sources.includes(estadoActual);
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
