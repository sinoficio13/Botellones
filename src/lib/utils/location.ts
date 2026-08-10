/**
 * Parse WhatsApp/Google Maps location link to extract coordinates.
 * Supports formats like:
 *   https://maps.google.com/?q=10.123,-66.456
 *   geo:10.123,-66.456
 *   https://maps.app.goo.gl/... (not parseable, user must paste coords manually)
 */
export function parseWhatsAppLocation(link: string): { lat: number; lng: number } | null {
  const googleMatch = link.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (googleMatch) {
    return { lat: parseFloat(googleMatch[1]), lng: parseFloat(googleMatch[2]) };
  }
  const geoMatch = link.match(/geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (geoMatch) {
    return { lat: parseFloat(geoMatch[1]), lng: parseFloat(geoMatch[2]) };
  }
  return null;
}
