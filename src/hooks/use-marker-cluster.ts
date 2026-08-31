'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { defaultIcon } from '@/lib/leaflet/icon-fix';
import { linkWhatsApp } from '@/lib/utils/whatsapp';
import type { ClienteMapa } from '@/lib/db/mapa';

/**
 * Custom hook for Leaflet marker clustering.
 * Uses react-leaflet's useMap() for imperative access to L.Map.
 * Creates L.markerClusterGroup, adds clustered markers with popups,
 * and cleans up on unmount.
 */
export function useMarkerCluster(markers: ClienteMapa[]) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    // Create cluster group
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });

    // Create markers
    markers.forEach((m) => {
      const marker = L.marker([m.latitud, m.longitud], { icon: defaultIcon });

      const whatsappLink = m.telefono_1
        ? `<a href="https://wa.me/${linkWhatsApp(m.telefono_1)}"
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

  return clusterGroupRef;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
