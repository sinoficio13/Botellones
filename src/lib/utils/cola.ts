/**
 * Central de Operaciones age/urgency helpers — pure, UI-agnostic (REQ-COS-18).
 * Mirrors the `grupos.ts` pure-util convention; `ahora` is injectable for
 * deterministic tests (design D8) and defaults to the real clock.
 *
 * Age format: <60min → "Nm"; 1–23h → "Nh" (rounded); ≥24h → "Nd" (rounded);
 * a future timestamp clamps to "0m". Urgency: <6h normal · 6–24h urgencia
 * · >24h critica. Tokens live in the consuming components, never here.
 */
export type NivelUrgencia = 'normal' | 'urgencia' | 'critica';

const MIN_MS = 60_000;
const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;

/** Age in ms, clamped to ≥0 (future timestamps count as 0). */
function antiguedadMs(estadoDesde: string, ahora?: Date): number {
  const diff = (ahora ?? new Date()).getTime() - new Date(estadoDesde).getTime();
  return diff > 0 ? diff : 0;
}

export function formatAntiguedad(estadoDesde: string, ahora?: Date): string {
  const ms = antiguedadMs(estadoDesde, ahora);
  if (ms < HORA_MS) return `${Math.floor(ms / MIN_MS)}m`;
  if (ms < DIA_MS) return `${Math.round(ms / HORA_MS)}h`;
  return `${Math.round(ms / DIA_MS)}d`;
}

export function nivelUrgencia(estadoDesde: string, ahora?: Date): NivelUrgencia {
  const horas = antiguedadMs(estadoDesde, ahora) / HORA_MS;
  if (horas < 6) return 'normal';
  if (horas <= 24) return 'urgencia';
  return 'critica';
}

/**
 * Cédula search normalization (REQ-COS-20, design D7): digits-only, with
 * spaces/separators and leading zeros stripped. Applied to BOTH the stored
 * cédula and the query so "12 345", "0012345" and "12345" all match.
 * NULL/empty → "" (unsearchable). Kept here as a pure helper so the server
 * helper (`buscarColaOperaciones`) and any client-side mirror share one rule.
 */
export function normalizarCedula(s: string | null): string {
  if (!s) return '';
  return s.replace(/\D/g, '').replace(/^0+/, '');
}