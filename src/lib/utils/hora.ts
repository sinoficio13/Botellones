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

// ── Business-timezone helpers ──
// Venezuela is UTC-4 year-round (no DST since 2007). Every date/time the
// business stores as a string (`recargas.fecha`, `recargas.hora`,
// `premios.fecha_alcanzado`) is computed in `America/Caracas`, and every
// timestamptz is displayed in that same zone. Using `Intl` with an explicit
// timeZone keeps the output deterministic regardless of the server or browser
// zone — never `toISOString()`/`toTimeString()`, which are host-zone based.

/** Canonical business timezone (Venezuela, fixed UTC-4). */
export const ZONA_NEGOCIO = 'America/Caracas';

/** Date → 'YYYY-MM-DD' in the business zone. */
export function formatFechaZona(d: Date, zona = ZONA_NEGOCIO): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return p.format(d); // en-CA renders YYYY-MM-DD
}

/** Date → 'HH:MM:SS' in the business zone. */
export function formatHoraZona(d: Date, zona = ZONA_NEGOCIO): string {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const h = p.format(d); // en-GB renders HH:MM:SS (24h clock)
  // Some locales format midnight as "24:xx:xx"; normalize to 00:xx:xx.
  return h.startsWith('24:') ? `00${h.slice(2)}` : h;
}

/** Today's date ('YYYY-MM-DD') in the business zone. */
export function hoyZona(zona = ZONA_NEGOCIO): string {
  return formatFechaZona(new Date(), zona);
}

/** Current time ('HH:MM:SS') in the business zone. */
export function horaAhoraZona(zona = ZONA_NEGOCIO): string {
  return formatHoraZona(new Date(), zona);
}