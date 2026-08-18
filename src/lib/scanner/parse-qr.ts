/**
 * Pure QR content validator for botellón codes.
 *
 * Accepts a full URL or a bare path whose pathname matches `/b/BOT-XXXXX`.
 * The origin is ignored by construction: only `pathname` is inspected, so
 * any domain (or a base-relative path) resolves to the same codigo.
 */

export type QrParseResult = { codigo: string };

const BOTELLON_PATH = /^\/b\/(BOT-\d{5})$/;

const FALLBACK_BASE = 'https://botellon.local';

export function parseQrCode(raw: string): QrParseResult | null {
  let url: URL;
  try {
    // The base URL makes bare paths like "/b/BOT-00001" parse; the origin of
    // `raw` is never inspected, only the resolved pathname.
    url = new URL(raw, FALLBACK_BASE);
  } catch {
    return null;
  }

  const match = BOTELLON_PATH.exec(url.pathname);
  if (!match) return null;
  return { codigo: match[1] };
}