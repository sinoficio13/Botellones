'use client';

import { useState, useEffect } from 'react';
import { useActionState } from 'react';
import dynamic from 'next/dynamic';
import { updateCliente } from '@/lib/db/clientes';
import { saveDireccion, getDireccion } from '@/lib/db/direcciones';
import { parseWhatsAppLocation } from '@/lib/utils/location';
import type { ClienteRow } from '@/lib/db/clientes';
import { MapPin, ExternalLink, Upload, Trash2 } from 'lucide-react';
import { FidelidadTab } from './fidelidad-tab';

// Leaflet must be imported dynamically (uses window)
const MapaLeaflet = dynamic(() => import('./mapa'), { ssr: false });

const TABS = ['Datos', 'Dirección', 'Fotos', 'Botellones', 'Historial', 'Fidelidad'] as const;
type Tab = (typeof TABS)[number];

export function ClienteTabs({ cliente }: { cliente: ClienteRow }) {
  const [activeTab, setActiveTab] = useState<Tab>('Datos');

  return (
    <div className="mt-6">
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
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
        {activeTab === 'Datos' && <DatosTab cliente={cliente} />}
        {activeTab === 'Dirección' && <DireccionTab clienteId={cliente.id} />}
        {activeTab === 'Fotos' && <FotosTab clienteId={cliente.id} />}
        {activeTab === 'Botellones' && <BotellonesTab clienteId={cliente.id} />}
        {activeTab === 'Historial' && <HistorialTab clienteId={cliente.id} />}
        {activeTab === 'Fidelidad' && (
          <FidelidadTab clienteId={cliente.id} totalRecargas={cliente.total_recargas} />
        )}
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

  useEffect(() => {
    getDireccion(clienteId).then((d) => {
      if (d) {
        setData(d);
        if (d.latitud && d.longitud) setCoords({ lat: d.latitud, lng: d.longitud });
        if (d.link_mapa) setLocationLink(d.link_mapa);
      }
      setLoaded(true);
    });
  }, [clienteId]);

  function handleParseLink() {
    const parsed = parseWhatsAppLocation(locationLink);
    if (parsed) {
      setCoords(parsed);
    } else {
      alert('No se pudieron extraer coordenadas del link. Pegá un link de Google Maps con formato ?q=LAT,LNG');
    }
  }

  if (!loaded) return <p className="text-sm text-zinc-400">Cargando…</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Dirección y ubicación</h2>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="cliente_id" value={clienteId} />
        <input type="hidden" name="latitud" value={coords?.lat || ''} />
        <input type="hidden" name="longitud" value={coords?.lng || ''} />
        <input type="hidden" name="link_mapa" value={locationLink} />

        <Grid2>
          <IField label="Calle" name="calle" def={data?.calle || ''} />
          <IField label="Avenida" name="avenida" def={data?.avenida || ''} />
          <IField label="Sector" name="sector" def={data?.sector || ''} />
          <IField label="Urbanización" name="urbanizacion" def={data?.urbanizacion || ''} />
          <IField label="Ciudad" name="ciudad" def={data?.ciudad || ''} />
          <IField label="Estado" name="estado" def={data?.estado || ''} />
        </Grid2>
        <IField label="Referencia" name="referencia" def={data?.referencia || ''} ta />

        {/* WhatsApp location parser */}
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Link de ubicación (WhatsApp / Google Maps)
          </label>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={locationLink}
              onChange={(e) => setLocationLink(e.target.value)}
              placeholder="https://maps.google.com/?q=10.123,-66.456"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button type="button" onClick={handleParseLink}
              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
              Extraer coordenadas
            </button>
          </div>
        </div>

        {/* Map */}
        {coords && (
          <div className="space-y-2">
            <div className="h-64 w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
              <MapaLeaflet lat={coords.lat} lng={coords.lng} />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <MapPin size={12} />
              <span>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
              <a
                href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
              >
                <ExternalLink size={12} /> Google Maps
              </a>
            </div>
          </div>
        )}

        {state?.error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{state.error}</div>}
        {state?.success && <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">Dirección guardada.</div>}

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
  const [botellones, setBotellones] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );
      supabase.from('botellones').select('*').eq('cliente_id', clienteId).order('fecha_creacion', { ascending: false })
        .then(({ data }) => { setBotellones(data || []); setLoading(false); });
    });
  }, [clienteId]);

  const estadoBadge: Record<string, string> = {
    activo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    asignado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    mantenimiento: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    dañado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    perdido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

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
              {botellones.map((b: any) => (
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
  const [recargas, setRecargas] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );
      supabase.from('recargas')
        .select('id, fecha, hora, botellon_id, botellones(codigo), realizada_por')
        .eq('cliente_id', clienteId)
        .order('fecha', { ascending: false })
        .order('hora', { ascending: false })
        .limit(50)
        .then(({ data }) => { setRecargas(data || []); setLoading(false); });
    });
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
                <th className="px-3 py-2 font-medium text-zinc-500">Botellón</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {recargas.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{new Date(r.fecha).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-zinc-500">{r.hora?.slice(0, 5)}</td>
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

// ── FOTOS TAB ──

function FotosTab({ clienteId }: { clienteId: string }) {
  const [fotos, setFotos] = useState<Array<{ id: string; tipo: string; ruta_storage: string; descripcion: string | null }>>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );
      supabase.from('fotos_clientes').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false })
        .then(({ data }) => setFotos(data || []));
    });
  }, [clienteId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );

      const path = `${clienteId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('fotos-clientes').upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('fotos-clientes').getPublicUrl(path);

      const { error: insertErr } = await supabase.from('fotos_clientes').insert({
        cliente_id: clienteId,
        tipo: 'adicional',
        ruta_storage: urlData.publicUrl,
        descripcion: file.name,
      });
      if (insertErr) throw insertErr;

      // Refresh
      const { data } = await supabase.from('fotos_clientes').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false });
      setFotos(data || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al subir foto');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Fotos {fotos.length > 0 && <span className="text-sm font-normal text-zinc-400">({fotos.length})</span>}
        </h2>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
          <Upload size={14} />
          {uploading ? 'Subiendo…' : 'Subir foto'}
          <input type="file" accept="image/*" capture="environment" onChange={handleUpload} className="hidden" />
        </label>
      </div>
      {fotos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-400">No hay fotos. Subí una desde el celular o la compu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {fotos.map((f) => (
            <div key={f.id} className="group relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              <img
                src={f.ruta_storage}
                alt={f.descripcion || 'Foto'}
                className="h-40 w-full object-cover"
                loading="lazy"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="text-xs text-white">{f.tipo}</p>
              </div>
            </div>
          ))}
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
  const inputClass = 'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50';
  return (
    <div className={cls}>
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
