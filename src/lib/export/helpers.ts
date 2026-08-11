'use server';

import { getConfiguracion } from '@/lib/db/configuracion';
import type { BusinessInfo } from '@/lib/export/types';

/**
 * Fetches business identity from the configuracion table.
 * Converts external logo URLs to base64 so @react-pdf/renderer can embed them.
 * Falls back to text-only header when no logo is configured or fetch fails.
 */
export async function getBusinessInfo(): Promise<BusinessInfo> {
  const config = await getConfiguracion();

  const date = new Date().toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const businessName = config.nombre_negocio || 'Botellón';

  let logoBase64: string | null = null;

  if (config.logo_url) {
    try {
      // If it's already a data URL, use it directly
      if (config.logo_url.startsWith('data:')) {
        logoBase64 = config.logo_url;
      } else {
        // Fetch external URL and convert to base64
        const response = await fetch(config.logo_url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const contentType = response.headers.get('content-type') || 'image/png';
          logoBase64 = `data:${contentType};base64,${buffer.toString('base64')}`;
        }
      }
    } catch {
      // Fetch failed — fall through to text-only header
    }
  }

  return { businessName, logoBase64, date };
}
