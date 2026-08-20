'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useMap } from 'react-leaflet';
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { defaultIcon } from '@/lib/leaflet/icon-fix';
import type { ClienteMapa } from '@/lib/db/mapa';

interface Props {
  markers: ClienteMapa[];
}

/** Barquisimeto, Lara — local business area */
const BARQUISIMETO_CENTER: [number, number] = [10.0678, -69.3473];

/** String fields of ClienteMapa (excludes latitud/longitud/botellones). */
type SearchableField = {
  [K in keyof ClienteMapa]: ClienteMapa[K] extends string | null ? K : never;
}[keyof ClienteMapa];

/** Fields matched by the free-text filter. */
const SEARCH_FIELDS: SearchableField[] = [
  'nombre',
  'negocio',
  'codigo',
  'sector',
  'urbanizacion',
  'ciudad',
  'estado',
  'calle',
  'avenida',
];

/** Fields used to build the autocomplete suggestions. */
const ADDRESS_FIELDS: SearchableField[] = [
  'sector',
  'urbanizacion',
  'ciudad',
  'estado',
];

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

      const phone = m.telefono_1 ? `58${m.telefono_1.replace(/\D/g, '')}` : '';

      // Compose the zone/address line shown in the pin.
      const dirPartes = [
        m.calle,
        m.avenida,
        m.sector,
        m.urbanizacion,
        m.ciudad,
        m.estado,
      ].filter(Boolean);
      const dirTexto = dirPartes.join(', ');

      // Exact location link + the text shared via the native share sheet.
      const mapsUrl = `https://www.google.com/maps?q=${m.latitud},${m.longitud}`;
      const shareText = `${m.nombre}${m.negocio ? ` (${m.negocio})` : ''}${dirTexto ? `: ${dirTexto}` : ''}`;

      // WhatsApp to contact the client directly (no prefilled text).
      const whatsappContactLink = phone ? `https://wa.me/${phone}` : '';

      const botellonesLabel =
        m.botellones.length > 0
          ? `${m.botellones.length} botellón${m.botellones.length > 1 ? 'es' : ''}`
          : '';

      const popupContent = `
        <div style="min-width:200px;font-family:system-ui,sans-serif;">
          ${m.codigo ? `<div style="font-size:11px;color:#71717a;margin-bottom:2px;">${escapeHtml(m.codigo)}</div>` : ''}
          <strong style="font-size:14px;">${escapeHtml(m.nombre)}</strong>
          ${m.negocio ? `<p style="margin:2px 0;font-size:12px;color:#666;">${escapeHtml(m.negocio)}</p>` : ''}
          ${dirTexto ? `<p style="margin:4px 0 0;font-size:12px;color:#333;">📍 ${escapeHtml(dirTexto)}</p>` : ''}
          ${botellonesLabel ? `<p style="margin:2px 0 0;font-size:12px;color:#333;">🗄 ${botellonesLabel}</p>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">
            ${
              whatsappContactLink
                ? `<a href="${whatsappContactLink}" target="_blank" rel="noopener noreferrer"
                      style="flex:1 1 auto;min-width:calc(50% - 3px);display:inline-flex;align-items:center;justify-content:center;padding:6px 8px;border-radius:6px;background:#25d366;color:#fff;text-decoration:none;font-size:12px;font-weight:600;">
                      WhatsApp
                   </a>`
                : ''
            }
            <button type="button" data-share="1"
                    data-share-text="${escapeHtml(shareText)}"
                    data-share-url="${mapsUrl}"
                    style="flex:1 1 auto;min-width:calc(50% - 3px);display:inline-flex;align-items:center;justify-content:center;padding:6px 8px;border-radius:6px;background:#0ea5e9;color:#fff;border:0;cursor:pointer;font-size:12px;font-weight:600;">
              Compartir ubicación
            </button>
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
               style="flex:1 1 auto;min-width:calc(50% - 3px);display:inline-flex;align-items:center;justify-content:center;padding:6px 8px;border-radius:6px;border:1px solid #d4d4d8;color:#2563eb;text-decoration:none;font-size:12px;font-weight:500;">
               Google Maps
             </a>
            <a href="/clientes/${m.id}"
               style="flex:1 1 auto;min-width:calc(50% - 3px);display:inline-flex;align-items:center;justify-content:center;padding:6px 8px;border-radius:6px;border:1px solid #d4d4d8;color:#18181b;text-decoration:none;font-size:12px;font-weight:500;">
               Ver ficha
             </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 280 });

      // Wire the "Compartir ubicación" button (Leaflet popup is raw HTML, so
      // attach the handler after the popup opens). Uses the native Web Share
      // API so the user picks the recipient (e.g. the delivery person).
      marker.on('popupopen', (e) => {
        const root = e.popup.getElement();
        const btn = root?.querySelector<HTMLButtonElement>('[data-share="1"]');
        if (!btn || btn.dataset.hooked) return;
        btn.dataset.hooked = '1';
        btn.addEventListener('click', () => {
          const text = btn.dataset.shareText ?? '';
          const url = btn.dataset.shareUrl ?? '';
          const payload = `${text}${text ? ' — ' : ''}${url}`;
          if (navigator.share) {
            navigator
              .share({ title: 'Ubicación', text: payload })
              .catch(() => {
                /* user cancelled or share failed — no-op */
              });
          } else if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(payload).catch(() => {});
          }
        });
      });

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
 * Inner component rendered INSIDE MapContainer so useMap() works.
 * Fits the viewport to the visible markers when a filter is active; returns
 * to the Barquisimeto default view when the filter is cleared. Empty result
 * sets are ignored so the map never fitBounds to nothing.
 */
function FitBoundsToMarkers({
  markers,
  filterActive,
}: {
  markers: ClienteMapa[];
  filterActive: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!filterActive) {
      map.setView(BARQUISIMETO_CENTER, 13);
      return;
    }
    if (markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map((m) => [m.latitud, m.longitud]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
  }, [map, markers, filterActive]);

  return null;
}

/**
 * Full-screen Leaflet map with marker clustering and a zone filter.
 * The filter matches client name/negocio/codigo plus address fields
 * (sector, urbanización, ciudad, estado, calle, avenida).
 */
function MapaInner({ markers: allMarkers }: Props) {
  const [filterQuery, setFilterQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

  const visibleMarkers = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return allMarkers.filter((m) => {
      if (q) {
        return SEARCH_FIELDS.some((field) => {
          const v = m[field];
          return v != null && String(v).toLowerCase().includes(q);
        });
      }
      return true;
    });
  }, [allMarkers, filterQuery]);

  const filterActive = filterQuery.trim().length > 0;

  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    allMarkers.forEach((m) => {
      if (m.sector) set.add(m.sector);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allMarkers]);

  const addressValues = useMemo(() => {
    const set = new Set<string>();
    allMarkers.forEach((m) => {
      ADDRESS_FIELDS.forEach((f) => {
        const v = m[f];
        if (v) set.add(v);
      });
    });
    return Array.from(set);
  }, [allMarkers]);

  const suggestions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return [];
    return addressValues.filter((v) => v.toLowerCase().includes(q)).slice(0, 8);
  }, [addressValues, filterQuery]);

  const showDropdown =
    inputFocused && filterQuery.trim().length > 0 && suggestions.length > 0;

  const clearFilters = () => {
    setFilterQuery('');
  };

  return (
    <>
      <MapContainer
        center={BARQUISIMETO_CENTER}
        zoom={13}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Zoom on the right so the address filter (top-left) never overlaps it */}
        <ZoomControl position="topright" />
        <MarkerClusterLayer markers={visibleMarkers} />
        <FitBoundsToMarkers markers={visibleMarkers} filterActive={filterActive} />
      </MapContainer>

      {/* Enhanced filter overlay */}
      <div className="pointer-events-none absolute left-4 top-4 z-[1000] w-64 max-w-[calc(100vw-2rem)] space-y-2">
        {/* Text input + autocomplete */}
        <div
          className="pointer-events-auto relative"
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (!next || !e.currentTarget.contains(next)) {
              setInputFocused(false);
            }
          }}
        >
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onFocus={() => setInputFocused(true)}
            placeholder="Filtrar por nombre, código o dirección..."
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-lg focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          {showDropdown && (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setFilterQuery(s);
                      setInputFocused(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Result counter + clear affordance */}
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="rounded-md bg-zinc-900/80 px-2 py-1 text-xs font-medium tabular-nums text-zinc-100 dark:bg-zinc-800">
            {visibleMarkers.length} de {allMarkers.length}
          </span>
          {filterActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md bg-zinc-900/80 px-2 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              Limpiar
            </button>
          )}
        </div>

        {filterActive && visibleMarkers.length === 0 && (
          <div className="pointer-events-auto rounded-md bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 dark:bg-zinc-800">
            Sin resultados
          </div>
        )}

        {/* Quick sector chips */}
        {sectorOptions.length > 0 && (
          <div className="pointer-events-auto">
            <div className="flex flex-wrap gap-1.5">
              {sectorOptions.map((s) => {
                const active = filterQuery.trim().toLowerCase() === s.toLowerCase();
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilterQuery(active ? '' : s)}
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-900/70 text-zinc-100 hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function MapaClientes({ markers }: Props) {
  return <MapaInner markers={markers} />;
}
