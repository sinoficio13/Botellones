import { getClientesConCoordenadas } from '@/lib/db/mapa';
import { MapaClientesWrapper } from '@/components/mapa/mapa-wrapper';

export const dynamic = 'force-dynamic';

export default async function MapaPage() {
  const markers = await getClientesConCoordenadas();

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <MapaClientesWrapper markers={markers} />
    </div>
  );
}
