'use client';

import { useState, useEffect } from 'react';
import { useActionState } from 'react';
import { updateCliente } from '@/lib/db/clientes';
import { saveDireccion, getDireccion, resolveMapLink } from '@/lib/db/direcciones';
import { parseWhatsAppLocation } from '@/lib/utils/location';
import type { ClienteRow } from '@/lib/db/clientes';
import { ESTADO_LABELS, ESTADO_COLORS } from '@/lib/utils/estados';
import { formatFechaLocal, formatHora12Str } from '@/lib/utils/hora';
import { FidelidadTab } from './fidelidad-tab';
import { createClient } from '@/lib/supabase/client';
import { MapPin, MessageCircle, ExternalLink, Droplets, CalendarDays, Award, Share2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const MapaEditable = dynamic(() => import('./mapa-editable'), { ssr: false });
const MapaLeaflet = dynamic(() => import('./mapa'), { ssr: false });

const TABS = ['Resumen', 'Datos', 'Dirección', 'Botellones', 'Historial', 'Fidelidad'] as const;
type Tab = (typeof TABS)[number];

export function ClienteTabs({ cliente }: { cliente: ClienteRow }) {
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');

  return (
    <div className="mt-6">
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {activeTab === 'Resumen' && <ResumenTab cliente={cliente} />}
        {activeTab === 'Datos' && <DatosTab cliente={cliente} />}
        {activeTab === 'Dirección' && <DireccionTab clienteId={cliente.id} />}
        {activeTab === 'Botellones' && <BotellonesTab clienteId={cliente.id} />}
        {activeTab === 'Historial' && <HistorialTab clienteId={cliente.id} />}
        {activeTab === 'Fidelidad' && (
          <FidelidadTab clienteId={cliente.id} totalRecargas={cliente.total_recargas} />
        )}
      </div>
    </div>
  );
}

// ── RESUMEN TAB ──

function ResumenTab({ cliente }: { cliente: ClienteRow }) {
  const [direccion, setDireccion] = useState<Record<string, string | null> | null>(null);
  const [botellones, setBotellones] = useState<Array<{ id: string; codigo: string; estado: string }>>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getDireccion(cliente.id).then((d) => setDireccion(d as unknown as Record<string, string | null>));
    const supabase = createClient();
    supabase.from('botellones')
      .select('id, codigo, estado')
      .eq('cliente_id', cliente.id)
      .order('fecha_creacion', { ascending: false })
      .limit(3)
      .then(({ data }) => setBotellones((data as unknown as typeof botellones) || []));
  }, [cliente.id]);

  const whatsappNum = (cliente.whatsapp || cliente.telefono_1 || '')?.replace(/\D/g, '');
  const dirCompuesta = direccion
    ? [direccion.calle, direccion.avenida, direccion.sector, direccion.urbanizacion, direccion.ciudad, direccion.estado]
        .filter(Boolean)
        .join(', ')
    : '';

  const mapsUrl = direccion?.link_mapa ||
    (direccion?.latitud != null && direccion?.longitud != null
      ? `https://www.google.com/maps?q=${Number(direccion.latitud)},${Number(direccion.longitud)}`
      : '');

  const handleShare = async () => {
    const shareData = {
      title: `Ubicación de ${cliente.nombre}`,
      text: dirCompuesta ? `${cliente.nombre}: ${dirCompuesta}` : `Ubicación de ${cliente.nombre}`,
      url: mapsUrl,
    };

    // Web Share API (mobile / modern browsers)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled — do nothing
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(mapsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Dirección + Contacto */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <MapPin size={14} /> Dirección de entrega
          </div>
          {dirCompuesta ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-zinc-900 dark:text-zinc-100">{dirCompuesta}</p>
              {direccion?.referencia && (
                <p className="text-xs text-zinc-500">{direccion.referencia}</p>
              )}
              {dirCompuesta && (
                <a
                  href={direccion?.link_mapa || `https://www.google.com/maps/search/${encodeURIComponent(dirCompuesta)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  <ExternalLink size={12} /> Ver en el mapa
                </a>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">Sin dirección registrada — completar en Dirección</p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <MessageCircle size={14} className="text-green-600" /> Contacto
          </div>
          {whatsappNum ? (
            <div className="mt-2 space-y-2">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {whatsappNum.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
              </p>
              {cliente.horario_preferido && (
                <p className="text-xs text-zinc-500">
                  🕐 {cliente.horario_preferido}
                  {cliente.contacto_preferido && ` · ${cliente.contacto_preferido}`}
                </p>
              )}
              <a
                href={`https://wa.me/${whatsappNum}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <MessageCircle size={12} /> Escribir por WhatsApp
              </a>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">Sin teléfono registrado</p>
          )}
        </div>
      </div>

      {/* Mapa de ubicación GPS (visible si hay coordenadas) */}
      {direccion?.latitud != null && direccion?.longitud != null && (
        <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-700">
          <div className="flex items-center justify-between px-4 pt-3 pb-0 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
              <MapPin size={12} /> Ubicación
            </span>
            <div className="flex items-center gap-1.5">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink size={12} /> Maps
              </a>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                {copied ? (
                  <>Copiado ✓</>
                ) : (
                  <><Share2 size={12} /> Compartir</>
                )}
              </button>
            </div>
          </div>
          <div className="mt-2 h-52 w-full">
            <MapaLeaflet lat={Number(direccion.latitud)} lng={Number(direccion.longitud)} />
          </div>
        </div>
      )}

      {/* Mini-cards */}
      <div className="grid grid-cols-3 gap-3">
        <MiniCard
          icon={<Droplets size={16} />}
          label="Botellones"
          value={botellones.length > 0 ? (
            <div className="space-y-1">
              {botellones.map((b) => (
                <div key={b.id} className="flex items-center gap-2">
                  <span className="font-mono text-xs">{b.codigo}</span>
                  <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${ESTADO_COLORS[b.estado] || 'bg-zinc-100 text-zinc-600'}`}>
                    {ESTADO_LABELS[b.estado] ?? b.estado}
                  </span>
                </div>
              ))}
            </div>
          ) : 'Sin botellones'}
        />
        <MiniCard
          icon={<CalendarDays size={16} />}
          label="Última recarga"
          value={cliente.total_recargas > 0 ? `${cliente.total_recargas} total` : 'Sin recargas'}
        />
        <MiniCard
          icon={<Award size={16} />}
          label="Fidelidad"
          value={
            <span className="flex items-center gap-1.5">
              <span className="font-semibold">Nivel {Math.floor(cliente.total_recargas / 10) + 1}</span>
              <span className="text-xs text-zinc-400">({cliente.total_recargas % 10}/10)</span>
            </span>
          }
        />
      </div>
    </div>
  );
}

function MiniCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {icon} {label}
      </div>
      <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100 text-sm">
        {value}
      </div>
    </div>
  );
}

// ── DATOS TAB ──

function DatosTab({ cliente }: { cliente: ClienteRow }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateCliente, null);

  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Datos del cliente</h2>
          <button onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
            Editar
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" value={cliente.nombre} />
          <Field label="Negocio" value={cliente.negocio} />
          <Field label="Cédula" value={cliente.cedula} />
          <Field label="Teléfono 1" value={cliente.telefono_1} />
          <Field label="Teléfono 2" value={cliente.telefono_2} />
          <Field label="WhatsApp" value={cliente.whatsapp} />
          <Field label="Tipo" value={cliente.tipo_cliente} />
          <Field label="Horario" value={cliente.horario_preferido} />
          <Field label="Días" value={cliente.dias_preferidos} />
          <Field label="Contacto pref." value={cliente.contacto_preferido} />
          <Field label="Observaciones" value={cliente.observaciones} span />
          <Field label="Registro" value={cliente.fecha_registro ? new Date(cliente.fecha_registro).toLocaleDateString() : null} />
        </dl>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Editar datos</h2>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={cliente.id} />
        <Grid2>
          <IField label="Nombre *" name="nombre" def={cliente.nombre} />
          <IField label="Negocio" name="negocio" def={cliente.negocio || ''} />
        </Grid2>
        <IField label="Cédula" name="cedula" def={cliente.cedula || ''} cls="max-w-sm" />
        <Grid2>
          <IField label="Teléfono 1 *" name="telefono_1" def={cliente.telefono_1 || ''} type="tel" />
          <IField label="Teléfono 2" name="telefono_2" def={cliente.telefono_2 || ''} type="tel" />
        </Grid2>
        <IField label="WhatsApp" name="whatsapp" def={cliente.whatsapp || ''} type="tel" cls="max-w-sm" />
        <Grid2>
          <IField label="Tipo" name="tipo_cliente" def={cliente.tipo_cliente || ''} />
          <IField label="Horario" name="horario_preferido" def={cliente.horario_preferido || ''} />
        </Grid2>
        <IField label="Días preferidos" name="dias_preferidos" def={cliente.dias_preferidos || ''} cls="max-w-sm" />
        <IField label="Contacto preferido" name="contacto_preferido" def={cliente.contacto_preferido || ''} cls="max-w-sm" />
        <IField label="Observaciones" name="observaciones" def={cliente.observaciones || ''} ta />

        {state?.error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{state.error}</div>}
        {state?.success && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">Cambios guardados.</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setEditing(false)}
            className="rounded-md border px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// ── DIRECCIÓN TAB ──

function DireccionTab({ clienteId }: { clienteId: string }) {
  const [state, formAction] = useActionState(saveDireccion, null);
  const [locationLink, setLocationLink] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    getDireccion(clienteId).then((d) => {
      if (d) {
        setData(d as unknown as Record<string, string>);
        setLocationLink(d.link_mapa || '');
        if (d.latitud && d.longitud) {
          setCoords({ lat: d.latitud, lng: d.longitud });
        }
      }
      setLoaded(true);
    });
  }, [clienteId]);

  const handlePasteLocation = async () => {
    const text = await navigator.clipboard.readText();
    setLocationLink(text);
    await applyLink(text);
  };

  // Apply a pasted/typed link: try direct parse, then server-side short-link resolution
  const applyLink = async (link: string) => {
    // Empty link → clear coordinates
    if (!link.trim()) {
      setCoords(null);
      return;
    }
    const parsed = parseWhatsAppLocation(link);
    if (parsed) {
      setCoords(parsed);
      return;
    }
    // Short link (maps.app.goo.gl) — resolve server-side
    if (/maps\.app\.goo\.gl|goo\.gl|g\.co\/maps/.test(link)) {
      const resolved = await resolveMapLink(link);
      if (resolved) {
        setCoords(resolved);
        reverseGeocode(resolved.lat, resolved.lng);
      }
    }
  };

  // Reverse geocode: fill address fields from coordinates
  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`
      );
      const geo = await res.json();
      const a = geo?.address;
      if (a) {
        setData((prev) => ({
          ...(prev || {}),
          calle: a.road || a.pedestrian || prev?.calle || '',
          avenida: a.avenue || prev?.avenida || '',
          sector: a.neighbourhood || a.suburb || prev?.sector || '',
          urbanizacion: a.residential || prev?.urbanizacion || '',
          ciudad: a.city || a.town || a.village || prev?.ciudad || '',
          estado: a.state || prev?.estado || '',
        }));
        setLocationLink(`https://www.google.com/maps?q=${lat},${lng}`);
      }
    } catch {
      // Reverse geocoding failed — keep existing fields
    } finally {
      setGeocoding(false);
    }
  };

  const handleMapMove = (lat: number, lng: number) => {
    setCoords({ lat, lng });
    reverseGeocode(lat, lng);
  };

  if (!loaded) return <p className="text-sm text-zinc-400">Cargando…</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Dirección</h2>

      {/* ── MAPA (lo más importante, arriba) ── */}
      <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-700">
        <div className="h-72 w-full">
          <MapaEditable
            lat={coords?.lat ?? 10.4806}
            lng={coords?.lng ?? -66.9036}
            onMove={handleMapMove}
          />
        </div>
        <div className="flex items-center justify-between bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {coords
              ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
              : 'Hacé click en el mapa para ubicar la dirección'}
          </span>
          {coords && (
            <a
              href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink size={10} /> Google Maps
            </a>
          )}
        </div>
      </div>

      {/* ── Formulario (debajo) ── */}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="cliente_id" value={clienteId} />
        {geocoding && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Rellenando dirección desde el mapa…</p>
        )}
        <Grid2>
          <IField label="Calle" name="calle" def={data?.calle || ''} />
          <IField label="Avenida" name="avenida" def={data?.avenida || ''} />
        </Grid2>
        <Grid2>
          <IField label="Sector" name="sector" def={data?.sector || ''} />
          <IField label="Urbanización" name="urbanizacion" def={data?.urbanizacion || ''} />
        </Grid2>
        <Grid2>
          <IField label="Ciudad" name="ciudad" def={data?.ciudad || ''} />
          <IField label="Estado" name="estado" def={data?.estado || ''} />
        </Grid2>
        <IField label="Referencia" name="referencia" def={data?.referencia || ''} ta />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Link de Google Maps</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={locationLink}
              onChange={(e) => {
                setLocationLink(e.target.value);
                applyLink(e.target.value);
              }}
              placeholder="Pega un link de Google Maps o WhatsApp"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button type="button" onClick={handlePasteLocation}
              className="rounded-md border px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400">
              Pegar
            </button>
          </div>
        </div>

        <input type="hidden" name="latitud" value={coords?.lat || ''} />
        <input type="hidden" name="longitud" value={coords?.lng || ''} />
        <input type="hidden" name="link_mapa" value={locationLink} />

        {state && 'error' in state && (state as { error: string }).error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</div>
        )}
        {state && 'success' in state && (state as { success: boolean }).success && (
          <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">Dirección guardada.</div>
        )}

        <button type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
          Guardar dirección
        </button>
      </form>
    </div>
  );
}

// ── BOTELLONES TAB ──

function BotellonesTab({ clienteId }: { clienteId: string }) {
  const [botellones, setBotellones] = useState<Array<{ id: string; codigo: string; estado: string; fecha_creacion: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('botellones')
      .select('id, codigo, estado, fecha_creacion')
      .eq('cliente_id', clienteId)
      .order('fecha_creacion', { ascending: false })
      .then(({ data }) => { setBotellones((data as unknown as typeof botellones) || []); setLoading(false); });
  }, [clienteId]);

  const estadoBadge = ESTADO_COLORS;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Botellones asignados {!loading && <span className="text-sm font-normal text-zinc-400">({botellones.length})</span>}
      </h2>
      {loading ? (
        <p className="text-sm text-zinc-400">Cargando…</p>
      ) : botellones.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay botellones asignados a este cliente.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-500">Código</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Estado</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Fecha creación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {botellones.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-mono text-xs">{b.codigo}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${estadoBadge[b.estado] || 'bg-zinc-100 text-zinc-600'}`}>
                      {b.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {b.fecha_creacion ? new Date(b.fecha_creacion).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── HISTORIAL TAB ──

function HistorialTab({ clienteId }: { clienteId: string }) {
  const [recargas, setRecargas] = useState<Array<{ id: string; fecha: string; hora: string; numero_registro: string; botellones: { codigo: string } | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('recargas')
      .select('id, fecha, hora, numero_registro, botellon_id, botellones(codigo)')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .limit(50)
      .then(({ data }) => { setRecargas((data as unknown as typeof recargas) || []); setLoading(false); });
  }, [clienteId]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Historial de recargas {!loading && <span className="text-sm font-normal text-zinc-400">({recargas.length})</span>}
      </h2>
      {loading ? (
        <p className="text-sm text-zinc-400">Cargando…</p>
      ) : recargas.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay recargas registradas para este cliente.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-500">Fecha</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Hora</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Registro</th>
                <th className="px-3 py-2 font-medium text-zinc-500">Botellón</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {recargas.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{formatFechaLocal(r.fecha)}</td>
                  <td className="px-3 py-2 text-zinc-500">{r.hora ? formatHora12Str(r.hora) : '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.numero_registro}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.botellones?.codigo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SHARED ──

function Field({ label, value, span }: { label: string; value: string | null; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-50">{value || '—'}</dd>
    </div>
  );
}

function IField({ label, name, def, type = 'text', cls = '', ta }: { label: string; name: string; def: string; type?: string; cls?: string; ta?: boolean }) {
  const inputClass = `mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${cls}`;
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      {ta ? (
        <textarea id={name} name={name} defaultValue={def} rows={3} className={inputClass} />
      ) : (
        <input id={name} name={name} type={type} defaultValue={def} className={inputClass} />
      )}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}