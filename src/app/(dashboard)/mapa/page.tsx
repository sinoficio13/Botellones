import nextDynamic from 'next/dynamic';
import { getClientesConCoordenadas } from '@/lib/db/mapa';

// Dynamic import: Leaflet needs browser APIs, so disable SSR
const MapaClientes = nextDynamic(
  () => import('@/components/mapa/mapa-clientes'),
  { ssr: false }
);

export const dynamic = 'force-dynamic';

export default async function MapaPage() {
  const markers = await getClientesConCoordenadas();

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <MapaClientes markers={markers} />
    </div>
  );
}
