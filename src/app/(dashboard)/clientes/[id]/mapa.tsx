'use client';

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { defaultIcon } from '@/lib/leaflet/icon-fix';

interface Props {
  lat: number;
  lng: number;
}

/**
 * Read-only map (no zoom controls, no interaction beyond pan).
 * Used inside the summary card. Calls invalidateSize() after mount
 * so Leaflet recalculates size correctly inside tabbed layouts.
 */
export default function MapaLeaflet({ lat, lng }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      scrollWheelZoom={false}
      zoomControl={false}
      dragging={true}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={defaultIcon} />
      <InvalidateSize />
    </MapContainer>
  );
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}