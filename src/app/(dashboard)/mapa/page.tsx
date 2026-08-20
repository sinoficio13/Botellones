import { getClientesConCoordenadas } from '@/lib/db/mapa';
import { MapaClientesWrapper } from '@/components/mapa/mapa-wrapper';

export const dynamic = 'force-dynamic';

export default async function MapaPage() {
  const markers = await getClientesConCoordenadas();

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] -mb-28 lg:mb-0">
      <MapaClientesWrapper markers={markers} />
    </div>
  );
}
