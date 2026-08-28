/**
 * Botellon lifecycle state machine — pure functions, no server-side deps.
 *
 * Ciclo físico del botellón (5 estados puros, sin planta ni excepciones):
 *   entregado → recibido → recarga → listo → entregado
 *   (+ recarga → delivery → entregado, + listo → delivery → entregado)
 * Los botellones sin cliente en `recibido`/`listo` son stock.
 *
 * Cada arista tiene su inversa en `REVERSIONES`: ningún estado es terminal,
 * un error se deshace en un paso, y `getEstadosPermitidos` es la única regla
 * de movimiento manual (unión dedup de avance + reversión + identidad).
 */
export const ESTADOS = [
  'entregado',
  'recibido',
  'recarga',
  'listo',
  'delivery',
] as const;
export type Estado = (typeof ESTADOS)[number];

const TRANSICIONES: Record<Estado, Estado[]> = {
  entregado: ['recibido'],
  recibido: ['recarga'],
  recarga: ['listo', 'delivery'],
  listo: ['entregado', 'delivery'],
  delivery: ['entregado'],
};

/**
 * Immediate-previous inverses of `TRANSICIONES` (locked set, spec R1):
 * each entry is exactly the set of estados that can reach the key in one
 * forward step. The inversion invariant `b ∈ getTransiciones(a) ⟺ a ∈
 * getReversiones(b)` is guarded by tests.
 */
const REVERSIONES: Record<Estado, Estado[]> = {
  entregado: ['listo', 'delivery'],
  recibido: ['entregado'],
  recarga: ['recibido'],
  listo: ['recarga'],
  delivery: ['listo', 'recarga'],
};

export function getTransiciones(estado: Estado): Estado[] {
  return TRANSICIONES[estado] || [];
}

export function getReversiones(estado: Estado): Estado[] {
  return REVERSIONES[estado] || [];
}

/**
 * Single manual-move rule: dedup union of forward transitions, reversions,
 * and the identity estado. No estado is terminal (every estado has ≥1
 * reversion), and a mistake is undone in one step.
 */
export function getEstadosPermitidos(estado: Estado): Estado[] {
  return [...new Set([...getTransiciones(estado), ...getReversiones(estado), estado])];
}

/**
 * Terminal operations of the batch flows (carga scanner + modal). Each
 * operation maps a set of source estados to a single target estado and
 * declares whether it needs a cliente_id (recarga and delivery) and whether
 * it creates a REC number (only recarga writes `recargas` rows). The
 * server-side `.in('estado', sources)` guard in `registrarOperacion` is the
 * source of truth; the UI mirrors it via `esTransicionValida` for live
 * green/red badges and via `destinosPosibles` for per-row destination hints.
 */
export type OperacionId = 'recibir' | 'recargar' | 'listo' | 'delivery' | 'entregar';

export const OPERACIONES: Record<
  OperacionId,
  { target: Estado; requiresCliente: boolean; createsRec: boolean; sources: Estado[] }
> = {
  recibir: { target: 'recibido', requiresCliente: false, createsRec: false, sources: ['entregado'] },
  recargar: { target: 'recarga', requiresCliente: true, createsRec: true, sources: ['recibido'] },
  listo: { target: 'listo', requiresCliente: false, createsRec: false, sources: ['recarga'] },
  delivery: { target: 'delivery', requiresCliente: true, createsRec: false, sources: ['recarga'] },
  entregar: { target: 'entregado', requiresCliente: true, createsRec: false, sources: ['delivery'] },
};

/**
 * Canonical human-readable labels for each batch operation. Single source of
 * truth (moved from the per-page local copies in the terminal and modal).
 */
export const OPERACION_LABELS: Record<OperacionId, string> = {
  recibir: 'Recibir',
  recargar: 'Recargar',
  listo: 'Listo',
  delivery: 'En delivery',
  entregar: 'Entregar',
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
export const ESTADOS_KANBAN: Estado[] = ['recibido', 'recarga', 'listo', 'delivery'];

/**
 * Canonical human-readable labels for each botellon estado. Consumed by badges,
 * selects, and public pages. Falls back to the raw estado value when a key is
 * unknown (future estados must not crash the UI).
 */
export const ESTADO_LABELS: Record<string, string> = {
  entregado: 'Entregado',
  recibido: 'Recibido',
  recarga: 'En recarga',
  listo: 'Listo',
  delivery: 'En delivery',
};

/**
 * Canonical badge color classes for each botellon estado. Contains both light
 * and dark-mode Tailwind variants. Unknown estados fall back to an empty string
 * (consumer renders without a colored badge).
 */
export const ESTADO_COLORS: Record<string, string> = {
  entregado: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  recibido: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-400',
  recarga: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  listo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  delivery: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};