'use client';

import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { defaultIcon } from '@/lib/leaflet/icon-fix';

interface Props {
  lat: number;
  lng: number;
}

/**
 * Mapa de solo lectura con un marcador en las coordenadas dadas. Se importa
 * dinámicamente (ssr:false) desde el form para no romper el prerender.
 */
export default function MapaPreview({ lat, lng }: Props) {
  return (
    <div className="h-52 w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={false}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={defaultIcon} />
      </MapContainer>
    </div>
  );
}