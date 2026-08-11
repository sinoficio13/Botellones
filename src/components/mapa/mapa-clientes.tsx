'use client';

import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useMarkerCluster } from '@/hooks/use-marker-cluster';
import type { ClienteMapa } from '@/lib/db/mapa';

interface Props {
  markers: ClienteMapa[];
}

/** Approximate center of Venezuela */
const VE_CENTER: [number, number] = [6.42375, -66.58973];

/**
 * Full-screen Leaflet map with marker clustering and optional sector filter.
 * Uses dynamic import (ssr: false) from the parent page.
 */
function MapaInner({ markers: allMarkers }: Props) {
  const [sectorFilter, setSectorFilter] = useState('');

  const visibleMarkers = sectorFilter.trim()
    ? allMarkers.filter(
        (m) =>
          m.sector?.toLowerCase().includes(sectorFilter.toLowerCase().trim())
      )
    : allMarkers;

  useMarkerCluster(visibleMarkers);

  return (
    <>
      <MapContainer
        center={VE_CENTER}
        zoom={7}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>

      {/* Sector filter overlay */}
      <div className="pointer-events-none absolute left-4 top-4 z-[1000]">
        <input
          type="text"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          placeholder="Filtrar por sector..."
          className="pointer-events-auto w-48 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-lg focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>
    </>
  );
}

export default function MapaClientes({ markers }: Props) {
  return <MapaInner markers={markers} />;
}
