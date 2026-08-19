import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Botellón',
    short_name: 'Botellón',
    description: 'Gestión de botellones de agua',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0a0a0a',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        // Next 16.3 manifest type allows a single purpose value; the
        // 192px icon above keeps the implicit "any" purpose.
        purpose: 'maskable',
      },
    ],
  };
}
