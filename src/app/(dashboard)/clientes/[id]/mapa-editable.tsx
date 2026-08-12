'use client';

import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { defaultIcon } from '@/lib/leaflet/icon-fix';

interface Props {
  lat: number;
  lng: number;
  onMove?: (lat: number, lng: number) => void;
}

/**
 * Interactive map: click or drag the marker to change coordinates.
 * Fires onMove when the position changes.
 */
export default function MapaEditable({ lat, lng, onMove }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterOnChange lat={lat} lng={lng} />
      <ClickHandler onMove={onMove} />
      <Marker
        position={[lat, lng]}
        icon={defaultIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const { lat: nLat, lng: nLng } = e.target.getLatLng();
            onMove?.(nLat, nLng);
          },
        }}
      />
    </MapContainer>
  );
}

function RecenterOnChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

function ClickHandler({ onMove }: { onMove?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}