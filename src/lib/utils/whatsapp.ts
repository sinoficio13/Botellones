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
