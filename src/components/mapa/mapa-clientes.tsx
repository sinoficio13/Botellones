'use client';

import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useMap } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { defaultIcon } from '@/lib/leaflet/icon-fix';
import type { ClienteMapa } from '@/lib/db/mapa';

interface Props {
  markers: ClienteMapa[];
}

/** Approximate center of Venezuela */
const VE_CENTER: [number, number] = [6.42375, -66.58973];

/**
 * Inner component rendered INSIDE MapContainer so useMap() works.
 */
function MarkerClusterLayer({ markers }: { markers: ClienteMapa[] }) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });

    markers.forEach((m) => {
      const marker = L.marker([m.latitud, m.longitud], { icon: defaultIcon });

      const whatsappLink = m.telefono_1
        ? `<a href="https://wa.me/58${m.telefono_1.replace(/\D/g, '')}"
              target="_blank" rel="noopener noreferrer"
              style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;
                     padding:4px 8px;border-radius:4px;background:#25d366;color:#fff;
                     text-decoration:none;font-size:12px;font-weight:500;">
              WhatsApp
           </a>`
        : '';

      const popupContent = `
        <div style="min-width:180px;font-family:system-ui,sans-serif;">
          <strong style="font-size:14px;">${escapeHtml(m.nombre)}</strong>
          ${m.negocio ? `<p style="margin:2px 0;font-size:12px;color:#666;">${escapeHtml(m.negocio)}</p>` : ''}
          ${m.telefono_1 ? `<p style="margin:2px 0;font-size:12px;color:#666;">📱 ${escapeHtml(m.telefono_1)}</p>` : ''}
          ${whatsappLink}
          <a href="/clientes/${m.id}"
             style="display:block;margin-top:4px;font-size:12px;color:#2563eb;text-decoration:none;">
             Ver ficha &rarr;
           </a>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 280 });
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    return () => {
      map.removeLayer(clusterGroup);
      clusterGroup.clearLayers();
    };
  }, [map, markers]);

  return null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Full-screen Leaflet map with marker clustering and optional sector filter.
 */
function MapaInner({ markers: allMarkers }: Props) {
  const [sectorFilter, setSectorFilter] = useState('');

  const visibleMarkers = sectorFilter.trim()
    ? allMarkers.filter(
        (m) =>
          m.sector?.toLowerCase().includes(sectorFilter.toLowerCase().trim())
      )
    : allMarkers;

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
        <MarkerClusterLayer markers={visibleMarkers} />
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
