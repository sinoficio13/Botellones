'use client';

import dynamic from 'next/dynamic';
import type { ClienteMapa } from '@/lib/db/mapa';

const MapaClientesInner = dynamic(
  () => import('@/components/mapa/mapa-clientes'),
  { ssr: false }
);

export function MapaClientesWrapper({ markers }: { markers: ClienteMapa[] }) {
  return <MapaClientesInner markers={markers} />;
}
