/**
 * Normalize a stored phone number into the international WhatsApp format
 * used by `https://wa.me/`. Venezuelan numbers only (assumed by contract):
 * strip non-digits, drop leading zeros, and prepend `58` unless already present.
 *
 * Non-VE international numbers are out of scope.
 */
export function normalizeWhatsAppPhone(raw?: string | null): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const noLeadingZero = digits.replace(/^0+/, '');
  return noLeadingZero.startsWith('58') ? noLeadingZero : `58${noLeadingZero}`;
}

/**
 * Locked `mensajeWhatsApp` literal (user spec §7.3, REQ-COS-28 — verbatim):
 * `{p}` = client FIRST name, `{u}` = "N botellones" or "tu botellón" by count.
 * Per-estado Spanish copy pre-loaded into the WhatsApp sheet; the operator
 * edits it before sending. Do NOT "fix" the grammar — this is the locked copy.
 */
export function mensajeWhatsApp(estado: string, nombre: string, cantidad: number): string {
  const p = nombre.split(' ')[0];
  const u = cantidad > 1 ? `${cantidad} botellones` : 'tu botellón';
  switch (estado) {
    case 'recibido': return `Hola ${p}, recibimos ${u}. Te aviso apenas ${cantidad > 1 ? 'estén' : 'esté'} listo${cantidad > 1 ? 's' : ''}.`;
    case 'recarga':  return `Hola ${p}, ya estamos recargando ${u}.`;
    case 'listo':    return `Hola ${p}, ${cantidad > 1 ? `tus ${cantidad} botellones están listos` : 'tu botellón está listo'}. ¿Te lo llevo hoy?`;
    case 'delivery': return `Hola ${p}, vamos en camino con ${u}.`;
    default:         return `Hola ${p}, `;
  }
}

/**
 * wa.me deep link (REQ-COS-28, D13): digits come from `normalizeWhatsAppPhone`;
 * the message is `encodeURIComponent`-encoded so spaces/accents in the Spanish
 * copy survive the URL. Opens in a new tab (anchor target handled by the sheet).
 */
export function buildWaLink(digitos: string, mensaje: string): string {
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}
