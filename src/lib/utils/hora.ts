/**
 * Shared time/date formatting for history views.
 *
 * Time is STORED canonically (24h strings / timestamptz); only the UI converts
 * to a 12-hour clock. Dates are stored as 'YYYY-MM-DD' strings and displayed
 * as 'DD/MM/YYYY' WITHOUT going through `new Date()` — parsing a bare date
 * with `new Date('YYYY-MM-DD')` treats it as UTC midnight, which displays the
 * PREVIOUS day in UTC-negative timezones (e.g. Venezuela, UTC-4).
 */

/** 12-hour clock from a Date ("4:37 PM"). */
export function formatHora12(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/** 12-hour clock from a stored "HH:MM[:SS]" string. */
export function formatHora12Str(hora: string): string {
  const [hh, mm] = hora.split(':');
  let h = parseInt(hh, 10) || 0;
  const m = mm ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' without any timezone shift. */
export function formatFechaLocal(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  if (!y || !m || !d) return fecha;
  return `${d}/${m}/${y}`;
}