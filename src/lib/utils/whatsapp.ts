/**
 * Compose a national phone number into the international WhatsApp format used
 * by `https://wa.me/` for an arbitrary country: strip non-digits, drop leading
 * zeros, and prepend the country code unless the number already starts with it.
 * If the country code is empty the national digits are returned as-is.
 */
export function componerWhatsApp(pais: string, numero: string): string {
  const digits = (numero ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const codigo = (pais ?? '').replace(/\D/g, '');
  const nacional = digits.replace(/^0+/, '');
  return codigo && nacional.startsWith(codigo) ? nacional : `${codigo}${nacional}`;
}

/**
 * Normalize a stored phone number into the international WhatsApp format.
 * Venezuelan numbers (assumed by contract for existing callers): same as
 * `componerWhatsApp('58', raw)` — strip non-digits, drop leading zeros, and
 * prepend `58` unless already present.
 */
export function normalizeWhatsAppPhone(raw?: string | null): string {
  return componerWhatsApp('58', raw ?? '');
}

/**
 * Digits for a `wa.me/` link from a stored number. Los valores nuevos ya están
 * en formato internacional (llevan su código de país: `584141234567`,
 * `573001234567`, `13035551234`…) y se respetan tal cual. Las filas legacy
 * venezolanas pueden estar en formato local (≤10 dígitos, sin `58`): se asume
 * VE y se prepone el código. Nunca fuerza un código sobre un internacional.
 */
export function linkWhatsApp(numero?: string | null): string {
  let d = (numero ?? '').replace(/\D/g, '');
  if (!d) return '';
  d = d.replace(/^0+/, '');
  if (!d.startsWith('58') && d.length <= 10) {
    d = `58${d}`;
  }
  return d;
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
